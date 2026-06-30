#!/usr/bin/env bash
# End-to-end auth/RBAC check. Run against a REAL Postgres.
#
#   cd server
#   npm install && npx prisma generate && npm run build
#   DATABASE_URL="postgresql://user:pass@host:5432/db" JWT_SECRET="test" bash scripts/e2e-auth.sh
#
# Verifies: developer login, /me, hidden-developer list, user creation with
# generated credentials, custom password, RBAC 403 for Staff, and that deleting
# a user invalidates their session (401) on the next request.
set -euo pipefail

: "${DATABASE_URL:?set DATABASE_URL to a reachable Postgres}"
export JWT_SECRET="${JWT_SECRET:-e2e-secret}"
PORT=4600
B="http://localhost:$PORT"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

npx --prefix "$DIR" prisma migrate deploy --schema "$DIR/prisma/schema.prisma"

PORT=$PORT NODE_ENV=development node "$DIR/dist/index.js" & SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
sleep 3

dev=/tmp/dev.jar; staff=/tmp/staff.jar
say() { printf '\n=== %s ===\n' "$1"; }

say "developer login (expect 200 + user)"
curl -s -i -c $dev -X POST $B/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"aryanbodkhe","password":"aryandeveloper"}' | sed -n '1p;/^{/p'

say "GET /me as developer (expect role DEVELOPER)"
curl -s -b $dev $B/api/auth/me; echo

say "create Owner 'Amit Sharma' (expect username amitsharma, password amitsharmaowner)"
curl -s -b $dev -X POST $B/api/users -H 'Content-Type: application/json' \
  -d '{"name":"Amit Sharma","role":"OWNER"}'; echo

say "create Staff with custom password 'secret123'"
curl -s -b $dev -X POST $B/api/users -H 'Content-Type: application/json' \
  -d '{"name":"Sita Staff","role":"STAFF","password":"secret123"}'; echo

say "list users (developer must NOT appear)"
curl -s -b $dev $B/api/users; echo

say "login as Staff, then GET /api/users (expect 403)"
curl -s -c $staff -X POST $B/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"sitastaff","password":"secret123"}' >/dev/null
curl -s -o /dev/null -w "staff -> /api/users status=%{http_code} (expect 403)\n" -b $staff $B/api/users

say "delete the Staff user (as developer), then Staff's next request -> 401"
SID=$(curl -s -b $dev $B/api/users | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const u=JSON.parse(s).users.find(x=>x.username==="sitastaff");process.stdout.write(u?u.id:"")})')
curl -s -b $dev -X DELETE $B/api/users/$SID >/dev/null
curl -s -o /dev/null -w "deleted staff -> /me status=%{http_code} (expect 401)\n" -b $staff $B/api/auth/me

echo; echo "E2E complete."
