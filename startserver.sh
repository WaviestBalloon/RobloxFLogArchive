echo "Starting server..."

if test -f "pnpm-lock.yaml"; then
	echo "Detected a pnpm lock file, using pnpm..."
	pnpm run builderman
elif test -f "yarn.lock"; then
	echo "Detected a yarn lock file, using yarn..."
	yarn run builderman
elif test -f "package-lock.json"; then
	echo "Detected a npm lock file, using npm..."
	npm run builderman
else
	echo "No lock file detected!"
	exit 1
fi

