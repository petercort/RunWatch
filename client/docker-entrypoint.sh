#!/bin/sh

# Replace environment variables in the built JavaScript files
echo "Replacing environment variables..."
for file in /usr/share/nginx/html/static/js/*.js; do
  echo "Processing $file..."
  sed -i \
    -e "s|http://localhost/api|${REACT_APP_API_URL}|g" \
    -e "s|ws://localhost|${REACT_APP_WEBSOCKET_URL}|g" \
    "$file"
done

echo "Starting Nginx..."
# Start nginx
exec "$@"