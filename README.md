# Deploy DRAMA on Microsoft Azure via ARM Template (with Kubernetes, CoreOS, and Flannel)

### Prerequisites: 
    1. Azure account 
    2. Node.js & npm 
    
### 1. Installation:	
    npm install (under project's root folder) 

### 2. Setup cluster configuration:
    cluster configuration is specified in conf/cluster.yaml
    (1) cluster_name must be unique for each cluster
    (2) master_ip must be within vnet address space

### 3. Login to Azure:		
        Winstonteki-MacBook-Air:azure-k8s Winston$ azure login
            info:    Executing command login
            -info:    To sign in, use a web browser to open the page https://aka.ms/devicelogin. Enter the code GSQFSTJBW to authenticate.
            -info:    Added subscription Visual Studio Professional with MSDN
            +
            info:    login command OK

### 4. Set Azure CLI to ARM mode
        Winstonteki-MacBook-Air:azure-k8s Winston$ azure config set mode arm

### 5. Create a resource group
        Winstonteki-MacBook-Air:azure-k8s Winston$ azure group create -n armkube -l "West US"

### 6. Validate resource group template
        Winstonteki-MacBook-Air:azure-k8s Winston$ azure group template validate -g armkube -f deployment/deployment-template.json -e deployment/deployment-template.parameters.json 

### 7. Deploy the template
        Winstonteki-MacBook-Air:azure-k8s Winston$ azure group deployment create --debug-setting All -g armkube -f deployment/deployment-template.json -e deployment/deployment-template.parameters.json -n arm-kube-deployment

### Notes:
    1. https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-linux-ssh-from-linux/
       (1) ssh-rsa keys are required for any deployment using the Azure portal, regardless of the deployment model.
       (2) .pem file are required to create VMs using the classic portal. .pem files are also supported in classic deployments that use the Azure CLI.
    2. https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-linux-troubleshoot-ssh-connection/