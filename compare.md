# Domain: System Architecture

**Sources**: claude_md, code_chunks, code_chunks, code_chunks, code_chunks, code_chunks, code_chunks
**Generated**: 2026-02-09T21:57:34.129Z

---

## Business Rules

### Pattern Version Consistency Enforcement

The system enforces that pattern versions between the Active Update (AU) server and the PSMS database must be strictly aligned for all relevant branches and release types. During job initialization, the service compares all version pairs (e.g., OTH, TBL) and aborts the job if any mismatch is detected. This prevents the propagation of inconsistent or partial pattern releases.

**Rationale**: This rule ensures that all downstream consumers (e.g., security products) receive a coherent and validated set of pattern files, preventing false negatives/positives in malware detection due to version skew.

**Sources**: code_chunks

---

### Rolling Storage Limit for Pattern Packages

The system maintains a strict rolling window of 14 versions for each pattern package type (OTH, TBL) per branch. When new versions are downloaded, the oldest packages are deleted to enforce this limit. This is checked before every download operation.

**Rationale**: This rule controls disk usage and ensures that only relevant, recent versions are available for rollback or audit, preventing resource exhaustion on the build agents.

**Sources**: code_chunks

---

### SHA1 Integrity Validation for Package Downloads

Before downloading a package from S3, the agent checks if the local file exists and whether its SHA1 hash matches the S3 metadata. If the hashes match, the download is skipped; otherwise, the file is re-downloaded and validated.

**Rationale**: This rule prevents unnecessary network transfers and ensures that only valid, untampered pattern files are used in the build process, reducing the risk of using corrupted or outdated data.

**Sources**: code_chunks

---

### Branch and Release Type Conditional Logic

Many steps in the command flow are conditionally executed based on the branch ID and release type (e.g., certain commands only run for branches with TBL support, or for CPR vs OPR releases). This is encoded in the command flow configuration and enforced at runtime.

**Rationale**: This rule allows the system to support a wide variety of product lines and release scenarios with a single orchestrator, ensuring that only relevant operations are performed for each job.

**Sources**: code_chunks

---

### Rollback Branch Handling

Branches with IDs &gt;&#x3D; 61 are treated as rollback branches, with their original branch ID computed as branchID - 60. Rollback jobs have different flow logic and may skip or alter certain steps.

**Rationale**: This rule supports emergency rollback scenarios, ensuring that only the intended subset of operations (e.g., package restoration, not full compilation) are performed, reducing risk during incident response.

**Sources**: code_chunks

---

## Program Flows

### Pattern Job Processing Pipeline

This is the core workflow that processes a pattern build job from SQS reception through package generation and upload. It is orchestrated as a multi-phase pipeline with strict validation and error handling at each stage.

**Steps**:

1. Receive job request from SQS queue and parse parameters.
2. Perform pre-check validations: version consistency, AU/DB alignment, and branch-specific rules.
3. Roll local package storage, deleting old versions to maintain window.
4. Download required OTH and TBL packages from S3, validating with SHA1.
5. Fetch pattern signatures from PSMS database and VSAPIX models as needed.
6. Execute the command flow: resource preparation, pattern compilation, diff/CRC generation, archiving, checksum calculation.
7. Upload generated packages to S3 and FTP destinations in parallel.
8. Send notification emails for upload and job completion.
9. Update job status and handle errors with compensation logic (e.g., retries, status rollback, notification on failure).

**Sources**: code_chunks

---

### Command Flow Orchestration

The package generation phase is implemented as a configurable command flow, where each command represents a discrete business operation (e.g., compile, diff, upload). Commands are executed asynchronously with dependency and condition management.

**Steps**:

1. Initialize command flow based on job parameters and branch configuration.
2. Evaluate conditions for each command (e.g., branch ID, release type, rollback status).
3. Execute commands asynchronously, respecting &#x27;waitFor&#x27; dependencies.
4. On command failure, propagate error to dependent commands and trigger compensation (e.g., abort, rollback, notification).
5. On success, update job status and proceed to next phase.

**Sources**: code_chunks

---

## Domain Models

### Pattern Job

Represents a single pattern build request, encapsulating all parameters and state required to process a pattern release for a given branch and release type.

**Attributes**:

- `patternJobID`: integer - Unique identifier for the job, used for tracking and logging.
- `branchID`: integer - Identifies the product branch (e.g., HouseCall, VT, ICRC).
- `releaseType`: enum/integer - Defines the release type (e.g., OPR, CPR, Rollback).
- `targetStep`: string - Indicates which pipeline phase to execute up to (e.g., Upload).
- `othVersion`: string - Version string for OTH pattern.
- `tblVersion`: string - Version string for TBL pattern.
- `status`: enum - Tracks job state (e.g., in progress, success, failed).

**Sources**: code_chunks

---

### Pattern Package

Represents a versioned malware pattern file (OTH or TBL) used for security scanning. Each package is associated with a branch, version, and release type.

**Attributes**:

- `type`: enum (OTH/TBL) - Distinguishes package kind.
- `version`: string - Semantic version of the package.
- `sha1`: string - Integrity hash for validation.
- `storageLocation`: string - S3 or FTP path where the package is stored.

**Sources**: code_chunks

---

### Branch

Represents a logical product line or deployment target (e.g., HouseCall, VT, ICRC). Each branch has unique configuration and may support different pattern types.

**Attributes**:

- `branchID`: integer - Unique branch identifier.
- `name`: string - Human-readable branch name.
- `hasTBL`: boolean - Indicates if TBL patterns are supported.

**Sources**: code_chunks

---

### Signature

Represents a malware pattern signature, including metadata such as malware name, type, and associated actions. Signatures are fetched from the PSMS database and used in pattern compilation.

**Attributes**:

- `malwareName`: string - Identifies the malware family or variant.
- `patternType`: enum - Specifies the signature type (e.g., VSAPI, DCT, TMWhite).
- `sourceText`: string - Hex-encoded pattern data.
- `activeAction`: string - Specifies the action to take when detected.

**Sources**: code_chunks

---

## Contracts & Interfaces

### Pattern Job REST API

**Purpose**: Allows external systems to submit, query, and manage pattern build jobs.

**Inputs**:

- `Pattern job submission payload (branchID, releaseType, targetStep, versions, etc.)` (object) - **required**

**Outputs**:

- `Job status (in progress, success, failed), error details, logs` (object)

**Sources**: code_chunks

---

### SQS Pattern Job Queue Contract

**Purpose**: Defines the structure and semantics of pattern job messages exchanged between the orchestrator and the agent service.

**Inputs**:

- `SQS message with job parameters (branchID, releaseType, etc.)` (object) - **required**

**Outputs**:

- `Acknowledgement of job receipt and processing outcome.` (object)

**Sources**: code_chunks

---

### Cloud Storage Upload Contract

**Purpose**: Ensures that generated pattern packages are uploaded to S3 and/or FTP with integrity and versioning.

**Inputs**:

- `Pattern package files, metadata (version, branch, SHA1).` (object) - **required**

**Outputs**:

- `Upload confirmation, storage location URL.` (object)

**Sources**: code_chunks

---

## User Stories

## System Invariants

- The system is designed around a strict separation of orchestration (job coordination, validation) and execution (command plugins), allowing new pattern types and branches to be added with minimal code changes.
- Spring XML-based configuration is used to define command flows, enabling dynamic reconfiguration of process logic without code redeployment. This supports rapid adaptation to new business requirements and incident response scenarios.
- The use of SQS for job queueing and S3/FTP for artifact storage decouples the agent service from upstream and downstream systems, improving reliability and scalability.
- All critical operations (downloads, uploads, database fetches) are guarded by integrity checks and retry logic, reflecting a bias toward correctness and auditability over raw performance.
- Branch and release type logic is highly parameterized, supporting a large product matrix with shared infrastructure but specialized flows.
- Pipeline/Workflow Orchestration: The job processing is structured as a multi-phase pipeline, with each phase corresponding to a business-relevant transformation or validation.
- Command Pattern: Each step in the package generation is encapsulated as a command object, allowing for modularity, reuse, and conditional execution.
- Dependency Injection (via Spring): All command flows and configuration are injected, enabling environment-specific logic and easy testing.
- Template Method: The command flow XML defines the skeleton of the algorithm, while command plugins provide the step implementations.
- Retry/Compensation: Critical operations are wrapped in retry logic with compensation steps for error handling, ensuring robustness in face of transient failures.
- Domain-Driven Design (DDD) Bounded Contexts: The system models core entities (PatternJob, PatternPackage, Branch, Signature) with clear boundaries and lifecycle rules.

---

## Source Citations

- **claude_md**: CLAUDE.md (analyzed via code chunks and LLM) (retrieved 2026-02-09T21:57:34.129Z)
- **code_chunks**: execution-logs/AgentServiceLog.md (retrieved 2026-02-09T21:57:34.129Z)
- **code_chunks**: CLAUDE.md (retrieved 2026-02-09T21:57:34.129Z)
- **code_chunks**: src/main/webapp/WEB-INF/spring/command-flow.xml (retrieved 2026-02-09T21:57:34.129Z)
- **code_chunks**: target/test-classes/spring/command-flow.xml (retrieved 2026-02-09T21:57:34.129Z)
- **code_chunks**: src/main/resources/PSMS_ConfigTable.all.sql (retrieved 2026-02-09T21:57:34.129Z)
- **code_chunks**: README.md (retrieved 2026-02-09T21:57:34.129Z)
