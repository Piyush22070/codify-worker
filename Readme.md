# RCE Worker Service

This service is responsible for securely executing user-submitted code inside Docker containers. It listens to a Redis queue (`codeQueue`), processes jobs, and stores execution results in MongoDB.

---

## Features

- ✅ Listens for jobs via Redis
- ✅ Executes code in isolated Docker containers
- ✅ Supports Python, C++, and Java
- ✅ Compares output with expected result
- ✅ Saves execution logs in MongoDB

---

## How It Works

1. Fetch job from `codeQueue` in Redis
2. Create a Docker container based on language
3. Mount user code and input into container
4. Capture output and compare with expected
5. Save result (pass/fail, logs) to MongoDB

---

## Supported Languages

- Python (`python:3.11`)
- C++ (`gcc:latest`)
- Java (`openjdk:latest`)

---

## Prerequisites

- Redis server running
- MongoDB connected
- Docker installed and running

---

## Running the Worker

```bash
npm install
npm run dev
