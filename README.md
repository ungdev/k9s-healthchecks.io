# Configuration on kubernetes
Create a service account `oc create sa healthchecks-sync`.
Create the CR and the CRB with `oc apply -f clusterrole.yml` and `oc apply -f clusterrolebinding.yml`.

Get a read write API Key on healthchecks.io.

Start the container with the environment variables listed in the .env.example