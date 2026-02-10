# Domain: System Architecture

**Sources**: claude_md, code_chunks
**Generated**: 2026-02-09T17:39:25.723Z

---

## Business Rules

### Version Consistency Enforcement

The system enforces that the AU (Active Update) server versions and the PSMS database versions for both OTH and TBL pattern types must be identical for the last 14 versions. This includes parsing version strings, comparing counts, and validating each version pair. If any mismatch is found, the job is aborted.

**Rationale**: This rule ensures that the pattern build operates on the most up-to-date and consistent signature data, preventing the release of outdated or mismatched pattern files that could compromise detection accuracy or regulatory compliance.

**Sources**: code_chunks

---

### Pattern Package Rolling Window

The system maintains a rolling window of the last 14 versions of both OTH and TBL pattern packages in local storage. When a new version is downloaded, the oldest is deleted to enforce the cap.

**Rationale**: This rule balances storage constraints with the need to support rollbacks and incremental builds, ensuring that recent history is always available while preventing unbounded disk usage.

**Sources**: code_chunks

---

### SHA1 Integrity Validation for Downloads

Before downloading a package from S3, the system computes the SHA1 hash of the local file and compares it to the hash stored in S3 metadata. If they match, the download is skipped; otherwise, the file is downloaded and validated.

**Rationale**: This rule prevents unnecessary network and compute resource usage, and ensures that only valid, untampered pattern files are used in the build process.

**Sources**: code_chunks

---

### Rollback Branch Identification

Branches with IDs &gt;&#x3D; 61 are treated as rollback branches, with their original branch ID computed as branchID - 60. This affects how jobs are routed and processed.

**Rationale**: This rule allows the system to distinguish between normal and rollback builds, ensuring that rollback jobs are handled with the correct historical context and do not interfere with mainline releases.

**Sources**: code_chunks

---

### High-Priority Job Routing

Jobs marked as high-priority are routed to a dedicated SQS queue and processed on higher-capacity instances (e.g., c5.4xlarge).

**Rationale**: This ensures that urgent pattern releases (e.g., for zero-day threats) are built and distributed with minimal latency, supporting business SLAs for threat response.

**Sources**: code_chunks

---

### Command Dependency and Conditional Execution

Each command in the build flow can specify dependencies (waitFor) and conditions (e.g., branch/release type filters). Commands only execute when their dependencies are satisfied and conditions are met.

**Rationale**: This rule enables flexible, maintainable orchestration of complex build pipelines, allowing for branch-specific logic and robust error isolation.

**Sources**: code_chunks

---

## Program Flows

### Pattern Build Job Lifecycle

This is the end-to-end flow for processing a pattern build job, from SQS message reception to package upload and notification. It ensures that all business validations, data fetches, compilations, and artifact distributions are performed in a controlled, auditable manner.

**Steps**:

1. Receive job request from SQS queue and parse parameters.
2. Perform pre-checks: version validation, branch/rollback determination, high-priority routing.
3. Download required OTH and TBL pattern packages from S3, enforcing rolling window and SHA1 validation.
4. Fetch pattern signatures and models from PSMS database and S3, generating dumps as needed.
5. Execute the CommandFlow: prepare resources, compile patterns, generate reports and diffs, archive, checksum, and upload artifacts.
6. Upload generated packages to S3 and multiple FTP destinations in parallel.
7. Send notification emails for OTH upload, TBL upload, and overall success.
8. Handle errors at each phase: abort on validation failures, retry downloads, log and notify on failures.

**Sources**: code_chunks

---

### CommandFlow Orchestration

The CommandFlow pattern enables dynamic, dependency-aware execution of build steps. Each command can run synchronously or asynchronously, with explicit dependency and condition management, supporting complex, branch-specific build logic.

**Steps**:

1. Load command flow configuration (command-flow.xml) for the current environment and branch.
2. For each command, evaluate its condition and waitFor dependencies.
3. Execute eligible commands in parallel or sequence as specified.
4. Propagate results and state to dependent commands.
5. On failure, halt dependent commands and log error context for diagnosis.
6. On completion, mark job as successful and trigger notifications.

**Sources**: code_chunks

---

## Domain Models

### Pattern Job

Represents a single pattern build request, including all parameters, state, and results. It is the core unit of work in the system, driving the orchestration of all downstream activities.

**Attributes**:

- `jobId`: identifier - Uniquely identifies the job for tracking and auditing
- `branchId`: branch identifier - Specifies the target product/branch for the build
- `releaseType`: enum - Indicates CPR/OPR/other release type
- `othVersion`: version string - Specifies the OTH pattern version to build
- `tblVersion`: version string - Specifies the TBL pattern version to build
- `status`: enum - Tracks job state (pending, in progress, failed, succeeded)

**Sources**: code_chunks

---

### Pattern Package

Represents a versioned artifact (OTH or TBL) containing compiled pattern signatures for distribution. Packages are stored in S3, FTP, and local rolling storage.

**Attributes**:

- `type`: enum (OTH/TBL) - Distinguishes between package types
- `version`: version string - Identifies the package version
- `sha1`: hash - Ensures integrity and deduplication
- `storageLocation`: URI - Tracks where the package is stored (S3/FTP/local)

**Sources**: code_chunks

---

### Branch

Represents a logical product line or customer segment (e.g., HouseCall, Consumer, MIP2). Each branch has its own versioning, configuration, and build logic.

**Attributes**:

- `branchId`: integer - Unique identifier for the branch
- `name`: string - Human-readable branch name
- `currentVersion`: string - Tracks the latest released version
- `tblCurrent`: string - Tracks the latest TBL version

**Sources**: code_chunks

---

## Contracts & Interfaces

### BuilderAgentService REST API

**Purpose**: Exposes endpoints for job submission, status retrieval, and log access to external automation systems.

**Inputs**:

- `Job submission payload (branchId, releaseType, versions, etc.)` (string) - **required**

**Outputs**:

- `Job status, logs, error details, artifact links` (string)

**Sources**: code_chunks

---

### SQS Pattern Job Message Contract

**Purpose**: Defines the schema for pattern build job requests delivered via SQS.

**Inputs**:

- `Job parameters (branchId, releaseType, targetStep, versions, priority)` (string) - **required**

**Outputs**:

- `Acknowledgement of receipt and processing outcome` (string)

**Sources**: code_chunks

---

### PSMS Database Contract

**Purpose**: Defines queries and data structures for fetching pattern signatures, version info, and configuration.

**Inputs**:

- `SQL queries for pattern dumps, version lookups` (string) - **required**

**Outputs**:

- `Pattern signature data, version metadata` (string)

**Sources**: code_chunks

---

### Cloud Storage/FTP Upload Contract

**Purpose**: Specifies the requirements for uploading and validating pattern packages to S3 and FTP endpoints.

**Inputs**:

- `Package files, metadata (SHA1, version, type)` (string) - **required**

**Outputs**:

- `Upload success/failure, storage URIs` (string)

**Sources**: code_chunks

---

### Notification Email Contract

**Purpose**: Defines the structure and triggers for build result notification emails sent to stakeholders.

**Inputs**:

- `Build outcome, package details, recipient lists` (string) - **required**

**Outputs**:

- `Email messages for OTH upload, TBL upload, and overall success` (string)

**Sources**: code_chunks

---

## User Stories

## System Invariants

- Version Consistency Enforcement: The system enforces that the AU (Active Update) server versions and the PSMS database versions for both OTH and TBL pattern types must be identical for the last 14 versions. This includes parsing version strings, comparing counts, and validating each version pair. If any mismatch is found, the job is aborted.
- Pattern Package Rolling Window: The system maintains a rolling window of the last 14 versions of both OTH and TBL pattern packages in local storage. When a new version is downloaded, the oldest is deleted to enforce the cap.
- SHA1 Integrity Validation for Downloads: Before downloading a package from S3, the system computes the SHA1 hash of the local file and compares it to the hash stored in S3 metadata. If they match, the download is skipped; otherwise, the file is downloaded and validated.
- Rollback Branch Identification: Branches with IDs &gt;&#x3D; 61 are treated as rollback branches, with their original branch ID computed as branchID - 60. This affects how jobs are routed and processed.
- High-Priority Job Routing: Jobs marked as high-priority are routed to a dedicated SQS queue and processed on higher-capacity instances (e.g., c5.4xlarge).
- Command Dependency and Conditional Execution: Each command in the build flow can specify dependencies (waitFor) and conditions (e.g., branch/release type filters). Commands only execute when their dependencies are satisfied and conditions are met.
- The system employs a message-driven, event-oriented architecture, decoupling job submission (SQS) from processing and enabling horizontal scaling.
- The CommandFlow pattern provides a declarative, data-driven approach to orchestrating complex, conditional, and parallel build steps, supporting rapid adaptation to new branches and requirements.
- Spring XML configuration is used extensively for environment-specific wiring, enabling flexible deployment across dev, test, staging, production, and DR environments without code changes.
- The use of rolling storage and SHA1 validation for pattern packages is a pragmatic trade-off between performance, cost, and operational safety (rollback, deduplication).
- Explicit error handling and compensation logic (e.g., retries, aborts, notifications) are built into every phase, supporting operational resilience and auditability.

---

## Source Citations

- **claude_md**: CLAUDE.md (analyzed via code chunks and LLM) (retrieved 2026-02-09T17:39:25.722Z)
- **code_chunks**: 50 code chunks analyzed by GPT-4 for System Architecture (retrieved 2026-02-09T17:39:25.722Z)
