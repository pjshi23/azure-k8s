# Deploy DRAMA on Microsoft Azure (with Kubernetes, CoreOS, and Flannel)

### Prerequisites: 
    1. Azure account 
    2. Node.js & npm 
    
Note: The project is based on "https://github.com/kubernetes/kubernetes/tree/master/docs/getting-started-guides/coreos/azure" with some modifications.

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

### 4. Create the cluster:
        Winstonteki-MacBook-Air:azure-k8s Winston$ ./create-kubernetes-cluster.js 
            azure_wrapper/info: Loaded state from `./conf/cluster.yaml`
            expected master node size = 1, existing size = NaN
            expected worker node size = 3, existing size = NaN
                                 ...
            azure_wrapper/info: Saved SSH config, you can use it like so: `ssh -F  ./output/k8s_ssh_conf <hostname>`
            azure_wrapper/info: The hosts in this deployment are:
                [ 'k8s-master-00','k8s-worker-00','k8s-worker-01','k8s-worker-02' ]
            azure_wrapper/info: Saved state into `./output/k8s_deployment.yaml`

###  5. Check cluster status
    download kubectl to your local machine first
         
        Winstonteki-MacBook-Air:azure-k8s Winston$ kubectl version
            Client Version: version.Info{Major:"1", Minor:"1", GitVersion:"v1.1.7", GitCommit:"e4e6878293a339e4087dae684647c9e53f1cf9f0", GitTreeState:"clean"}
            Server Version: version.Info{Major:"1", Minor:"1", GitVersion:"v1.1.4", GitCommit:"a5949fea3a91d6a50f40a5684e05879080a4c61d", GitTreeState:"clean"}

        Winstonteki-MacBook-Air:azure-k8s Winston$ kubectl get nodes
            NAME            LABELS                                 STATUS    AGE
            k8s-master-00   kubernetes.io/hostname=k8s-master-00   Ready     15m
            k8s-worker-00   kubernetes.io/hostname=k8s-worker-00   Ready     14m
            k8s-worker-01   kubernetes.io/hostname=k8s-worker-01   Ready     12m
            k8s-worker-02   kubernetes.io/hostname=k8s-worker-02   Ready     11m

        Winstonteki-MacBook-Air:azure-k8s Winston$ kubectl get namespaces
            NAME          LABELS    STATUS    AGE
            default       <none>    Active    16m
            develop       <none>    Active    16m
            kube-system   <none>    Active    16m
            production    <none>    Active    16m
            staging       <none>    Active    16m
            

        Winstonteki-MacBook-Air:azure-k8s Winston$ kubectl get pods --all-namespaces
            NAMESPACE     NAME                                    READY     STATUS    RESTARTS   AGE
            kube-system   heapster-v1.0.2-joylc                   1/1       Running   0          16m
            kube-system   kube-apiserver-k8s-master-00            1/1       Running   0          17m
            kube-system   kube-controller-manager-k8s-master-00   1/1       Running   0          17m
            kube-system   kube-dns-v9-vx9o3                       4/4       Running   0          16m
            kube-system   kube-proxy-k8s-master-00                1/1       Running   0          17m
            kube-system   kube-proxy-k8s-worker-00                1/1       Running   0          16m
            kube-system   kube-proxy-k8s-worker-01                1/1       Running   0          14m
            kube-system   kube-proxy-k8s-worker-02                1/1       Running   0          13m
            kube-system   kube-scheduler-k8s-master-00            1/1       Running   0          17m
            kube-system   kube-vulcand-rc-oqavt                   3/3       Running   0          17m


### 6. Enable browsers to access Spark UI on Azure, add an entry to your DNS server
        Example:
        [winston@infra2 ~]$ sudo vi /etc/dnsmasq.d/lab504.conf
            address=/.k8s.azure/[Public IP of k8s-master-00]
        [winston@infra2 ~]$ sudo systemctl restart dnsmasq      
        
        URLs at Browser: http://spark-master-1.default.k8s.azure:8080
                         http://spark-master-2.default.k8s.azure:8080

### 7. Scale the cluster when needed:
    (1). Scale Out    
        Winstonteki-MacBook-Air:azure-k8s Winston$ ./scale-kubernetes-cluster.js ./output/k8s_deployment.yaml 2
            azure_wrapper/info: Loaded state from `./output/k8s_deployment.yaml`
            expected worker node size = 5, existing size = 3
                                 ...            
            azure_wrapper/info: Saved SSH config, you can use it like so: `ssh -F  ./output/k8s_ssh_conf <hostname>`
            azure_wrapper/info: The hosts in this deployment are:
                [ 'k8s-master-00','k8s-worker-00','k8s-worker-01','k8s-worker-02','k8s-worker-03','k8s-worker-04' ]
            azure_wrapper/info: Saved state into `./output/k8s_deployment.yaml`

        Winstonteki-MacBook-Air:azure-k8s Winston$ kubectl get no
            NAME            LABELS                                 STATUS    AGE
            k8s-master-00   kubernetes.io/hostname=k8s-master-00   Ready     25m
            k8s-worker-00   kubernetes.io/hostname=k8s-worker-00   Ready     25m
            k8s-worker-01   kubernetes.io/hostname=k8s-worker-01   Ready     23m
            k8s-worker-02   kubernetes.io/hostname=k8s-worker-02   Ready     22m
            k8s-worker-03   kubernetes.io/hostname=k8s-worker-03   Ready     2m
            k8s-worker-04   kubernetes.io/hostname=k8s-worker-04   Ready     1m

    (2). Scale In  
        Winstonteki-MacBook-Air:azure-k8s Winston$ ./scale-kubernetes-cluster.js ./output/k8s_deployment.yaml -1
            azure_wrapper/info: Loaded state from `./output/k8s_deployment.yaml`
            expected worker node size = 4, existing size = 5
                                 ...             
            azure_wrapper/info: Saved SSH config, you can use it like so: `ssh -F  ./output/k8s_ssh_conf <hostname>`
            azure_wrapper/info: The hosts in this deployment are:
                [ 'k8s-master-00','k8s-worker-00','k8s-worker-01','k8s-worker-02','k8s-worker-03' ]
            azure_wrapper/info: Saved state into `./output/k8s_deployment.yaml`     
            
        Winstonteki-MacBook-Air:azure-k8s Winston$ kubectl get no
            NAME            LABELS                                 STATUS     AGE
            k8s-master-00   kubernetes.io/hostname=k8s-master-00   Ready      30m
            k8s-worker-00   kubernetes.io/hostname=k8s-worker-00   Ready      29m
            k8s-worker-01   kubernetes.io/hostname=k8s-worker-01   Ready      27m
            k8s-worker-02   kubernetes.io/hostname=k8s-worker-02   Ready      26m
            k8s-worker-03   kubernetes.io/hostname=k8s-worker-03   Ready      6m
            k8s-worker-04   kubernetes.io/hostname=k8s-worker-04   NotReady   5m    
                
### 8. Shutdown the cluster:
        Winstonteki-MacBook-Air:azure-k8s Winston$ ./shutdown-cluster.js ./output/k8s_deployment.yaml 
       
        Winstonteki-MacBook-Air:azure-k8s Winston$ azure vm list
            info:    Executing command vm list
            + Getting virtual machines                                                     
            data:    Name           Status              Location        DNS Name                   IP Address
            data:    -------------  ------------------  --------------  -------------------------  ----------
            data:    k8s-master-00  StoppedDeallocated  West US         k8s-service.cloudapp.net             
            data:    k8s-worker-00  StoppedDeallocated  West US         k8s-service.cloudapp.net             
            data:    k8s-worker-01  StoppedDeallocated  West US         k8s-service.cloudapp.net             
            data:    k8s-worker-02  StoppedDeallocated  West US         k8s-service.cloudapp.net             
            data:    k8s-worker-03  StoppedDeallocated  West US         k8s-service.cloudapp.net             
            info:    vm list command OK
        
### 9. Startup the cluster:
        Winstonteki-MacBook-Air:azure-k8s Winston$ ./start-cluster.js ./output/k8s_deployment.yaml 
            azure_wrapper/info: Loaded state from `./output/k8s_deployment.yaml`
        
        Winstonteki-MacBook-Air:azure-k8s Winston$ kubectl get no
            NAME            LABELS                                 STATUS     AGE
            k8s-master-00   kubernetes.io/hostname=k8s-master-00   Ready      2h
            k8s-worker-00   kubernetes.io/hostname=k8s-worker-00   Ready      1h
            k8s-worker-01   kubernetes.io/hostname=k8s-worker-01   Ready      1h
            k8s-worker-02   kubernetes.io/hostname=k8s-worker-02   Ready      1h
            k8s-worker-03   kubernetes.io/hostname=k8s-worker-03   Ready      1h
            k8s-worker-04   kubernetes.io/hostname=k8s-worker-04   NotReady   1h                         
                                 
        Winstonteki-MacBook-Air:azure-k8s Winston$ kubectl get pods --all-namespaces
            NAMESPACE     NAME                                    READY     STATUS        RESTARTS   AGE
            kube-system   heapster-v1.0.2-joylc                   1/1       Running       1          2h
            kube-system   kube-apiserver-k8s-master-00            1/1       Running       1          2h
            kube-system   kube-controller-manager-k8s-master-00   1/1       Running       1          2h
            kube-system   kube-dns-v9-vx9o3                       4/4       Running       4          2h
            kube-system   kube-proxy-k8s-master-00                1/1       Running       1          2h
            kube-system   kube-proxy-k8s-worker-00                1/1       Running       1          2h
            kube-system   kube-proxy-k8s-worker-01                1/1       Running       1          1h
            kube-system   kube-proxy-k8s-worker-02                1/1       Running       1          1h
            kube-system   kube-proxy-k8s-worker-03                1/1       Running       1          1h
            kube-system   kube-proxy-k8s-worker-04                1/1       Terminating   0          1h
            kube-system   kube-scheduler-k8s-master-00            1/1       Running       1          2h
            kube-system   kube-vulcand-rc-oqavt                   3/3       Running       3          2h

### 10. Destroy the cluster:
        Winstonteki-MacBook-Air:azure-k8s Winston$ ./destroy-cluster.js ./output/k8s_deployment.yaml 
            azure_wrapper/info: Loaded state from `./output/k8s_deployment.yaml`


## NOTES:
    1. Some modifications to be consistent with our lab deployment
        (1) deploy etcd2 together with kubernetes nodes & etcd2 master node collocates with kubernetes master node.
        (2) --cluster-domain=cluster.local (for kubelet service)
        (3) add additional namespaces (json files) to /addons for creating namespaces (develop,staging, production)
        (4) add kubeconfig related context,token,and policy to /auth
        (5) add kube-apiserver.yaml,kube-controller.yaml,kube-scheduler.yaml, and kube-proxy.yaml to /manifests 
        (6) set master node with static private IP address, because its IP changes will lead to etcd cluster malfunction.
    2. Assure vulcand deployed at master node via NodeSelector with label, e.g. "kubernetes.io/hostname: k8s-master-00"
    3. Assure not use port 80 for vulcand proxied services at this moment
    4. Deploy kubelet & kube-proxy to all nodes, including master node. 
        (1) --register-schedulable=false is an unknown flag for kubernetes v1.1.4
        (2) --register-node=false will make vulcand & skydns un-deployable at master node.
    5. etcd2 problems encountered:
        (1) etcd2 startup ordering problem: 
            Avoid enabling etcd2.service by default
            etcd2 should start after coreos-cloudinit, use "journalctl -b -u oem-cloudinit -u etcd2" and "systemctl list-dependencies --reverse etcd2" to debug when they run in wrong order.
            [https://github.com/coreos/bugs/issues/438]  
        (2) etcd2 single node reboot problem: 
            fixed in etcd version > 2.2.1 [https://github.com/coreos/etcd/issues/4288]   
    6. Useful resources for systemd's unit dependencies & ordering:
        (1) https://fedoramagazine.org/systemd-getting-a-grip-on-units/
        (2) https://fedoramagazine.org/systemd-unit-dependencies-and-order/
        (3) https://fedoramagazine.org/systemd-converting-sysvinit-scripts/
    7. Assure cross-hosts container networking setup successfully (e.g. flanneld) before launching any pods/containers by kubelet. 
        (1) Set kubelet.service with related settings for Restart, Requires and After to achieve it.   
        (2) For flanneld case, set the dependency, ordering, and restart of docker.service for flanneld. 
        [https://github.com/coreos/flannel/issues/112]
    8. CoreOS VM on Azure drop network when overlay vxlan is under load 
        [https://github.com/coreos/bugs/issues/1156]
        Currently fixed at v1010.1.0 (alpha release channel)
    9.  TODO:
        (1) Kubernetes security enhancement
            Per CoreOS document, it suggests secure inter-nodes communications.
            -- The master/worker nodes have used certificates for authentication, as do service-accounts and user-accounts.
            -- Authorization policy is also deployed for resource access control.
            Due to our modified vulcand hasn't implemented secure ways to talk to api server, let kube-apiserver's insecure-bind-address=0.0.0.0 instead of 127.0.0.1 for now.
            The external world won't be able to connect to api server via insecure port if we didn't expose that insecure endpoint of master host in Azure.
            Note:
            It's recommended to access the api server from a pod via a "kubectl proxy" sidecar container in the pod, however, websocket (used in our modified vulcand) doesn't work with kubectl proxy.
            [https://github.com/kubernetes/kubernetes/issues/24482] & [https://github.com/kubernetes/kubernetes/issues/17032]
        (2) Use Azure DNS server instead of Infra2@lab
        (3) Kubernetes master HA
        (4) Azure Resource Manager Template with Scale Set
        
