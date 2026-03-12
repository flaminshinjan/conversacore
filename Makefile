.PHONY: up down build test dev

up:
	docker compose up --build -d

down:
	docker compose down

build:
	docker compose build

dev:
	cd voice-gateway && uv run uvicorn app.main:app --reload --port 8000

test:
	cd voice-gateway && uv run pytest tests/ -v
