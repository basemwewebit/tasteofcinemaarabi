# Quickstart - Validation

Because this is a security patch, there is no new "API" to test. Rather, validation is executed by running the security analysis tools:

## Verifying the Patch

1. **Secret & Injection Review**:
```bash
# Expect [OK] Secure
python3 .agent/skills/vulnerability-scanner/scripts/security_scan.py . --type secrets
python3 .agent/skills/vulnerability-scanner/scripts/security_scan.py . --type code_patterns
```

2. **Configuration Review**:
```bash
# Expect CSP, HSTS, X-Frame-Options configured
python3 .agent/skills/vulnerability-scanner/scripts/security_scan.py . --type configuration
```

3. **Dependency Check**:
```bash
# Expect zero missing lock-file warnings on invalid package managers
python3 .agent/skills/vulnerability-scanner/scripts/security_scan.py . --type dependencies
```
