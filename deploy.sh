#!/bin/bash

# Make script exit on first error
set -e

# Function to display usage instructions
show_usage() {
    echo "Usage: ./deploy.sh [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start       - Start all services"
    echo "  stop        - Stop all services"
    echo "  restart     - Restart all services"
    echo "  logs        - Show logs from all services"
    echo "  build       - Rebuild all services"
    echo "  clean       - Remove all containers and volumes"
    echo "  status      - Show status of all services"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo "Error: Docker is not running"
        exit 1
    fi
}

case "$1" in
    "start")
        check_docker
        echo "Starting RunWatch services..."
        docker-compose up -d
        echo "Services started successfully!"
        ;;
    "stop")
        check_docker
        echo "Stopping RunWatch services..."
        docker-compose down
        echo "Services stopped successfully!"
        ;;
    "restart")
        check_docker
        echo "Restarting RunWatch services..."
        docker-compose restart
        echo "Services restarted successfully!"
        ;;
    "logs")
        check_docker
        docker-compose logs -f
        ;;
    "build")
        check_docker
        echo "Rebuilding RunWatch services..."
        docker-compose build --no-cache
        docker-compose up -d
        echo "Services rebuilt and started successfully!"
        ;;
    "clean")
        check_docker
        echo "Removing all containers and volumes..."
        docker-compose down -v
        echo "Cleanup completed successfully!"
        ;;
    "status")
        check_docker
        docker-compose ps
        ;;
    *)
        show_usage
        ;;
esac