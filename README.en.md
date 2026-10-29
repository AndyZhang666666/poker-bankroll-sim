# Bankroll Simulator

[中文](README.md) · [Project index](https://github.com/AndyZhang666666/AndyZhang666666/blob/main/PROJECTS.en.md) · [Live demo](https://andyzhang666666.github.io/poker-bankroll-sim/)

Is reaching a target once the same as finishing above it?

## Product decisions

- Retain the balance when a path cannot fund another step.
- Report stopping, ever reaching a target and terminal success separately.
- Use seeds for reproducibility and keep sampling uncertainty distinct from model error.

## Walkthrough

1. Set the starting balance, stake, volatility and win assumptions.
2. Inspect sample paths, quantile bands and terminal distributions as separate views.
3. Sweep one assumption and export the seed, model version and results.

## Run mode and limits

A seeded synthetic modelling exercise with independent rounds, no rake and no real player behaviour. Not a financial forecast or a tool for real-money wagering.

## Develop locally

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/poker-bankroll-sim/`. The repository base path is part of the URL.

## Lightweight checks

```sh
npm run check
npm run build
```

These commands are provided for reproduction; this documentation update did not run a new model benchmark.

## Documentation

- [Event definitions and validation](docs/VALIDATION.md)
- [Implementation details and original records, Chinese](README.md)

Use the repository’s existing licence and notices. This update does not change usage rights.
