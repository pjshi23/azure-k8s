#!/opt/local/bin/bash

SVC_NAME="kube"
KUBE_MASTER_FQDN=""
KUBE_MASTER_SECURE_PORT="443"


function create-tls-assets() {

    # define user list
    declare -A -r user_accounts=( \
        ["admin"]="default" \
        ["rd"]="develop" \
        ["qa"]="staging" \
        ["it"]="production" \
    )

    mkdir -p ./credentials/${SVC_NAME}/{ca,master,worker,user}

    # create a cluster root ca
    openssl genrsa -out ./credentials/${SVC_NAME}/ca/ca-key.pem 2048
    openssl req -x509 -new -nodes -key ./credentials/${SVC_NAME}/ca/ca-key.pem -days 10000 -out ./credentials/${SVC_NAME}/ca/ca.pem -subj "/CN=${SVC_NAME}-ca"
    
    # create api server keypair
    openssl genrsa -out ./credentials/${SVC_NAME}/master/apiserver-key.pem 2048
    openssl req -new -key ./credentials/${SVC_NAME}/master/apiserver-key.pem -out ./credentials/apiserver.csr -subj "/CN=kube-apiserver" -config ./output/master-openssl.cnf
    openssl x509 -req -in ./credentials/apiserver.csr -CA ./credentials/${SVC_NAME}/ca/ca.pem -CAkey ./credentials/${SVC_NAME}/ca/ca-key.pem -CAcreateserial -out ./credentials/${SVC_NAME}/master/apiserver.pem -days 365 -extensions v3_req -extfile ./output/master-openssl.cnf
    
    # create common worker kyepairs
    openssl genrsa -out ./credentials/${SVC_NAME}/worker/worker-key.pem 2048
    openssl req -new -key ./credentials/${SVC_NAME}/worker/worker-key.pem -out ./credentials/worker.csr -subj "/CN=dummy-worker" -config ./output/worker-openssl.cnf
    openssl x509 -req -in ./credentials/worker.csr -CA ./credentials/${SVC_NAME}/ca/ca.pem -CAkey ./credentials/${SVC_NAME}/ca/ca-key.pem -CAcreateserial -out ./credentials/${SVC_NAME}/worker/worker.pem -days 365 -extensions v3_req -extfile ./output/worker-openssl.cnf   
    
    rm ./credentials/worker.csr
    rm ./credentials/apiserver.csr
    cp ./credentials/${SVC_NAME}/ca/ca.pem ./credentials/${SVC_NAME}/master/ 
    cp ./credentials/${SVC_NAME}/ca/ca.pem ./credentials/${SVC_NAME}/worker/ 

    # create cluster users keypair & kube config
    kubectl config set preferences.colors true
    kubectl config set-cluster ${SVC_NAME}-cluster --server=https://${KUBE_MASTER_FQDN}:${KUBE_MASTER_SECURE_PORT} --certificate-authority=./credentials/${SVC_NAME}/ca/ca.pem
    for account in "${!user_accounts[@]}"; do
        local context=${user_accounts[$account]}
            
        openssl genrsa -out ./credentials/${SVC_NAME}/user/${account}-key.pem 2048
        openssl req -new -key ./credentials/${SVC_NAME}/user/${account}-key.pem -out ./credentials/user.csr -subj "/CN=${account}"
        openssl x509 -req -in ./credentials/user.csr -CA ./credentials/${SVC_NAME}/ca/ca.pem -CAkey ./credentials/${SVC_NAME}/ca/ca-key.pem -CAcreateserial -out ./credentials/${SVC_NAME}/user/${account}.pem -days 365
        
        kubectl config set-credentials ${SVC_NAME}-${account} --certificate-authority=./credentials/${SVC_NAME}/ca/ca.pem --client-key=./credentials/${SVC_NAME}/user/${account}-key.pem --client-certificate=./credentials/${SVC_NAME}/user/${account}.pem
        kubectl config set-context ${SVC_NAME}-${account} --cluster=${SVC_NAME}-cluster --user=${SVC_NAME}-${account} --namespace=${context}
    done
    kubectl config use-context ${SVC_NAME}-admin
    rm ./credentials/user.csr
}

####################################################################################
if [ "$#" -ne 3 ];
then
    echo "Usage: create_tls_assets.sh <svc_name> <kube_master_fqdn> <kube_master_secure_port>"
else
    SVC_NAME="$1"
    KUBE_MASTER_FQDN="$2"
    KUBE_MASTER_SECURE_PORT="$3"
#    rm -f ~/.kube/config
    create-tls-assets 
    echo "== create tls assets done =="
    echo "== ToDo: copy ~/.kube/config to your kubectl host(s)"
fi