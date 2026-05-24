# Monica Kubernetes Deployment

This keeps the same three-service shape as `docker-compose.yml`:

- `frontend`: React/Vite static build served by Nginx.
- `backend`: FastAPI token/report/support API on port 8000.
- `agent`: LiveKit Monica worker.

The frontend image is built with `VITE_API_BASE_URL=/api`; Nginx proxies `/api/*` to the internal `backend` Kubernetes Service.

## 1. Build images

For Docker Desktop Kubernetes, build normally:

```bash
docker build -t monica-backend:latest -f backend.Dockerfile .
docker build -t monica-agent:latest -f agent.Dockerfile .
docker build \
  -t monica-frontend:latest \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY="$VITE_CLERK_PUBLISHABLE_KEY" \
  --build-arg VITE_API_BASE_URL=/api \
  ./frontend
```

For `minikube`, run `eval $(minikube docker-env)` before building. For `kind`, build locally and then run:

```bash
kind load docker-image monica-backend:latest monica-agent:latest monica-frontend:latest
```

For a remote cluster, push these images to a registry and update the image names in `k8s/kustomization.yaml`.

## 2. Create the namespace and secrets

```bash
kubectl apply -f k8s/namespace.yaml
kubectl -n monica create secret generic monica-secrets \
  --from-env-file=.env \
  --dry-run=client \
  -o yaml | kubectl apply -f -
```

`SUPABASE_URL` should be set for Kubernetes. Without it, the backend and agent fall back to pod-local SQLite files that are not durable and are not shared between pods.

## 3. Deploy

```bash
kubectl apply -k k8s
kubectl -n monica rollout status deployment/backend
kubectl -n monica rollout status deployment/agent
kubectl -n monica rollout status deployment/frontend
```

## 4. Access locally

Port-forward the frontend service:

```bash
kubectl -n monica port-forward svc/frontend 8080:80
```

Then open `http://localhost:8080`.

If your cluster has an Nginx Ingress controller, the included Ingress serves `http://monica.localhost`. Add a hosts entry if your environment does not resolve `*.localhost` to `127.0.0.1`.

## Useful operations

```bash
kubectl -n monica get pods,svc,ingress
kubectl -n monica logs deployment/backend
kubectl -n monica logs deployment/agent
kubectl -n monica logs deployment/frontend
```

