"""Shared crawler error types to control routing and retry behavior."""
from __future__ import annotations


class SourceConfigError(ValueError):
    """Raised when a source configuration is invalid or unsupported."""


class ConnectorNotImplementedError(SourceConfigError):
    """Raised when a connector is intentionally stubbed or unavailable."""


class NonRetryableCrawlError(Exception):
    """Raised for permanent failures that should not be retried."""


class TransientCrawlError(Exception):
    """Raised for temporary failures that can be retried."""
