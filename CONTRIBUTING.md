# Contributing to NYC Taxi Fare Predictor

Thank you for your interest in contributing! This is a portfolio/educational project, but contributions and suggestions are welcome.

## How to Contribute

### Reporting Issues
- Use the [GitHub Issues](../../issues) tab to report bugs or suggest improvements.
- Provide a clear description and steps to reproduce the issue.

### Suggesting Enhancements
- Open an issue with the `enhancement` label.
- Describe the feature, its use case, and how it fits into the existing architecture.

### Submitting Changes

1. **Fork** the repository.
2. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** and commit with clear, descriptive messages:
   ```bash
   git commit -m "feat: add cross-validation to training pipeline"
   ```
4. **Push** to your fork and submit a **Pull Request**.

### Commit Message Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix   | Use Case                        |
|----------|---------------------------------|
| `feat:`  | New feature                     |
| `fix:`   | Bug fix                         |
| `docs:`  | Documentation changes           |
| `style:` | Formatting (no logic change)    |
| `refactor:` | Code restructuring           |
| `test:`  | Adding/updating tests           |
| `chore:` | Build scripts, dependencies     |

## Development Setup

See the [README.md](README.md) for setup instructions.

### Quick Reference

```bash
# ML Inference Service
cd service/ml-inference
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# API Gateway
cd service/api-gateway
cp .env.example .env    # Add your API keys
npm install && npm start

# Frontend
cd service/web-frontend
cp .env.example .env
npm install && npm run dev
```

## Code Style

- **Python**: Follow PEP 8. Use type hints where practical.
- **JavaScript**: ESLint configuration is provided in the frontend.
- **Commits**: Use conventional commit messages.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
