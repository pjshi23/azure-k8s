#!/usr/bin/bash

readonly TOKENS_FILE="./addons/auth_token"
readonly POLICY_FILE="./addons/auth_policy"
KUBE_MASTER_IP=""

# Generate random token for user accounts
function create-auth-token() {

    # define user list
    declare -A -r user_accounts=( \
        ["admin"]="default" \
        ["rd"]="develop" \
        ["qa"]="staging" \
        ["it"]="production" \
    )

    # generate file containing PEM-encoded x509 RSA key, used to verify ServiceAccount tokens
    #openssl genrsa -out ./addons/auth_service_account.key 2048 2>/dev/null

    # init kube config
    kubectl config set preferences.colors true
    kubectl config set-cluster azure-kubernetes --server=https://${KUBE_MASTER_IP}:3443 --api-version=v1 --insecure-skip-tls-verify=true

    # grant system account full priviledge
    echo "{\"readonly\": true}" >> "${POLICY_FILE}"

    # grant the default service account full privilege in all namespace, 'kube-system' is wildcard string.
    echo "{\"user\":\"system:serviceaccount:kube-system:default\"}" >> "${POLICY_FILE}"

    # iterate each account
    for account in "${!user_accounts[@]}"; do
        local context=${user_accounts[$account]}

        # generate random auth token
        token=$(dd if=/dev/urandom bs=128 count=1 2>/dev/null | base64 | tr -d "=+/" | dd bs=32 count=1 2>/dev/null)
        # in a csv file with 3 columns: token, user name, user uid.
        echo "${token},${account},${account}" >> "${TOKENS_FILE}"

        # configure kubectl
        kubectl config set-credentials ${account} --token=${token}
        kubectl config set-context ${context} --cluster=azure-kubernetes --user=${account} --namespace=${context}

        # grant priviledge
        if [ "admin" = ${account} ];
        then 
            echo "{\"user\":\"${account}\"}" >> "${POLICY_FILE}"
        else
            echo "{\"user\":\"${account}\", \"namespace\":\"${context}\"}" >> "${POLICY_FILE}"
        fi

    done

    kubectl config use-context default
}

####################################################################################
if [ -z "$1" ];
then
    echo "Usage: create_auth_token.sh <kube_master_public_ip>"
else
    KUBE_MASTER_IP="$1"
    rm -f ~/.kube/config
    rm -f "${TOKENS_FILE}"
    rm -f "${POLICY_FILE}"
    create-auth-token 
    echo "== create auth_token done =="
    echo "== ToDo: copy ~/.kube/config to your kubectl host(s)"
    echo "== ToDo: copy auth_* files to related folder"
fi
