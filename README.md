# Deploy DRAMA on Microsoft Azure via ARM Template (with Kubernetes, CoreOS, and Flannel)

### Prerequisites: 
    1. Azure account 
    2. Node.js & npm 
    
### 1. Installation:	
    npm install (under project's root folder) 

### 2. Setup cluster configuration:
    cluster configuration is specified in conf/arm_cluster.yaml
    (1) resourcegroup_name must be unique for each cluster
    (2) location is lower-cased without whitespace
    (3) master_hostip must be within vnet address space

### 3. Login to Azure:		
        Winstonteki-MacBook-Air:azure-k8s Winston$ azure login
            info:    Executing command login
            -info:    To sign in, use a web browser to open the page https://aka.ms/devicelogin. Enter the code GSQFSTJBW to authenticate.
            -info:    Added subscription Visual Studio Professional with MSDN
            +
            info:    login command OK

### 4. Set Azure CLI to ARM mode
        Winstonteki-MacBook-Air:azure-k8s Winston$ azure config set mode arm

### 5. Create the resource group
    assure the resource group name & location are consistent with conf/arm_cluster.yaml
        Winstonteki-MacBook-Air:azure-k8s Winston$ azure group create -n kube -l "West US"

### 6. Create cluster template file
        Winstonteki-MacBook-Air:azure-k8s Winston$ ./create-kubernetes-cluster-template.js

### 7. Validate the resource group template
        Winstonteki-MacBook-Air:azure-k8s Winston$ azure group template validate -g kube -f output/kube_deployment.json

### 8. Create the cluster via template file
        Winstonteki-MacBook-Air:azure-k8s Winston$ azure group deployment create --debug-setting All -g kube -f output/kube_deployment.json -n kube-deployment

### 9. Check cluster status
        Winstonteki-MacBook-Air:azure-k8s Winston$ kubectl get nodes
        Winstonteki-MacBook-Air:azure-k8s Winston$ kubectl get namespaces
        Winstonteki-MacBook-Air:azure-k8s Winston$ kubectl get services --all-namespaces
        Winstonteki-MacBook-Air:azure-k8s Winston$ kubectl get pods --all-namespaces

### 10. SSH to each VM to check status if needed
        (1) Winstonteki-MacBook-Air:azure-k8s Winston$ ssh-add ./credentials/kube/kube_ssh
        // ssh to master VM
        (2) Winstonteki-MacBook-Air:azure-k8s Winston$ ssh -A core@kube-cluster.westus.cloudapp.azure.com  
        // ssh to worker VMs through master
        (3) core@kube-master00 ~ $ ssh -A core@kube-worker000000

### 11. Scale-up / Scale-down the cluster
    for example, expand/shrink to 3 nodes:
        Winstonteki-MacBook-Air:azure-k8s Winston$  azure group deployment create --debug-setting All -g kube -f output/kube_scaling.json -n kube-deployment
            info:    Executing command group deployment create
            info:    Supply values for the following parameters
            workerVMSize: Standard_A2
            numberOfNodes: 3

### 12. Shutdown the cluster
        Winstonteki-MacBook-Air:azure-k8s Winston$ azure vmss deallocate -g kube -n workerset --instance-ids "*"
        Winstonteki-MacBook-Air:azure-k8s Winston$ azure vm deallocate -g kube -n kube-master00

### 13. Start the cluster
        Winstonteki-MacBook-Air:azure-k8s Winston$ azure vm start -g kube -n kube-master00
        Winstonteki-MacBook-Air:azure-k8s Winston$ azure vmss start -g kube -n workerset --instance-ids "*"

### 14. Destroy the cluster
        Winstonteki-MacBook-Air:azure-k8s Winston$ azure group delete -n kube

### Notes:
    1. https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-linux-ssh-from-linux/
       (1) ssh-rsa keys are required for any deployment using the Azure portal, regardless of the deployment model.
       (2) .pem file are required to create VMs using the "classic" portal. .pem files are also supported in "classic" deployments that use the Azure CLI.
    2. https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-linux-troubleshoot-ssh-connection/
