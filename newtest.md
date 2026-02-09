# Domain: System Architecture

**Sources**: claude_md, code_chunks
**Generated**: 2026-02-09T20:49:43.309Z

---

## Business Rules

### Version Consistency Enforcement

The system enforces that the versions of TBL and OTH pattern packages on the Active Update (AU) server exactly match those in the PSMS database for the last 14 versions. This includes validating both the count and the actual version strings, and ensuring that every version pair aligns before proceeding.

**Rationale**: This rule ensures that only consistent, synchronized pattern data is used for security scanning, preventing discrepancies that could lead to incomplete or faulty pattern releases. If violated, pattern jobs may be built on outdated or mismatched data, undermining scan reliability.

**Sources**: code_chunks

---

### Rolling Package Retention Policy

The system maintains only the latest 14 versions of each pattern package type (TBL and OTH) in local storage. When new packages are downloaded, older ones are deleted to enforce this rolling window.

**Rationale**: This rule controls disk usage and ensures that only relevant, recent pattern versions are available for build operations. Violating this could exhaust local storage or cause builds to use obsolete patterns.

**Sources**: code_chunks

---

### SHA1 Integrity Validation for Downloads

Before downloading a package from S3, the system checks if a local file with the same SHA1 hash exists. If so, the download is skipped, optimizing bandwidth and ensuring file integrity.

**Rationale**: This rule prevents redundant downloads and guarantees that only verified, uncorrupted files are used in pattern builds. If skipped, the system may waste resources or use tampered files.

**Sources**: code_chunks

---

### Branch Rollback Identification

Branches with IDs &gt;&#x3D; 61 are treated as rollback branches, and the original branch ID is computed as branchID - 60. This affects how pattern jobs are processed and which data sources are used.

**Rationale**: This rule supports controlled rollback scenarios, allowing the system to build patterns for previous releases in a traceable way. If violated, rollback jobs may be misrouted or built with incorrect data.

**Sources**: code_chunks

---

### High-Priority Job Routing

Jobs marked as high-priority are routed to a dedicated SQS queue and processed on high-performance compute instances (e.g., c5.4xlarge).

**Rationale**: This ensures that urgent pattern releases are built and delivered with minimal latency, supporting critical security operations. If not enforced, high-priority jobs may be delayed by regular workloads.

**Sources**: code_chunks

---

### Command Dependency and Conditional Execution

Each build command declares explicit dependencies (waitFor) and conditional execution rules (condition) based on job parameters such as branch, release type, and rollback status. Commands execute only when dependencies are satisfied and conditions are met.

**Rationale**: This rule ensures correct orchestration and prevents race conditions or invalid operations (e.g., compiling before resources are ready). If ignored, builds may fail or produce inconsistent artifacts.

**Sources**: code_chunks

---

## Program Flows

### Pattern Build Job Lifecycle

This is the end-to-end workflow for processing a pattern build job, from SQS message receipt to package upload and notification. It ensures that only validated, up-to-date pattern signatures are compiled, packaged, and distributed.

**Steps**:

1. Receive job request from SQS queue and parse parameters.
2. Validate AU server and database versions for consistency.
3. Determine if the job is a rollback or high-priority case.
4. Roll local package storage to retain only the latest 14 versions.
5. Download required TBL/OTH packages from S3, using SHA1 validation to skip unchanged files.
6. Fetch pattern signatures from PSMS database and VSAPIX models from S3 as needed.
7. Generate pattern dump files using factory logic.
8. Initialize and execute a sequence of build commands via CommandFlow, respecting dependencies and conditions.
9. Compile patterns, generate diffs, archives, and metadata.
10. Upload resulting packages to S3 and multiple FTP destinations in parallel.
11. Send notification emails for OTH/TBL uploads and overall job success.
12. Update job status and handle any errors with retries or compensation logic.

**Sources**: code_chunks

---

### CommandFlow Orchestration

The CommandFlow pattern manages the execution of 30+ build commands, each with its own dependencies and conditional logic. It enables asynchronous, parallel, and conditional execution of build steps, ensuring correct sequencing and resource utilization.

**Steps**:

1. Load command definitions and configurations from XML.
2. For each command, evaluate its condition map against job parameters.
3. Wait for declared dependencies (waitFor) to be satisfied.
4. Execute eligible commands asynchronously or synchronously as configured.
5. On failure, apply retry logic or abort the flow depending on error type.
6. Aggregate results and propagate completion signals to dependent commands.

**Sources**: code_chunks

---

## Domain Models

### Pattern Job

Represents a single pattern build request, including all parameters needed to orchestrate a build (branch, release type, versions, etc.). It is the core unit of work in the system.

**Attributes**:

- `jobId`: Identifier - Uniquely identifies the job across the system
- `branchId`: Branch Identifier - Specifies which product/branch the pattern is for
- `releaseType`: Enum (OPR/CPR) - Distinguishes between Official and Controlled Pattern Releases
- `targetStep`: String - Indicates the final step to execute (e.g., Upload)
- `othVersion`: Pattern Version - Version of OTH pattern to build
- `tblVersion`: Pattern Version - Version of TBL pattern to build
- `priority`: Enum - Indicates if the job is high-priority

**Sources**: code_chunks

---

### Pattern Package

A versioned artifact (TBL or OTH) containing compiled pattern data for security scanning. Packages are stored, rolled, and distributed as part of the build process.

**Attributes**:

- `type`: Enum (TBL/OTH) - Distinguishes the package content
- `version`: Pattern Version - Tracks the version for rolling and validation
- `sha1`: Hash - Ensures file integrity and enables download optimization
- `location`: URI/Path - Indicates where the package is stored (local/S3/FTP)

**Sources**: code_chunks

---

### Command

An atomic build operation (e.g., compile, archive, upload) executed within a CommandFlow. Commands declare dependencies, conditions, and configuration for flexible orchestration.

**Attributes**:

- `commandName`: String - Identifies the operation to execute
- `iD`: Integer - Unique identifier for dependency management
- `condition`: Map - Specifies when the command should run
- `waitFor`: Map - Lists dependencies on other commands
- `multiThreadType`: Enum (Async/Sync) - Controls execution mode
- `commandConfigs`: Map - Holds parameterized configuration

**Sources**: code_chunks

---

## Contracts & Interfaces

### BuilderAgentService REST API

**Purpose**: Exposes endpoints for external automation systems to trigger and monitor pattern build jobs.

**Inputs**:

- `Pattern build job parameters (branchId, releaseType, versions, etc.) via HTTP request` (string) - **required**

**Outputs**:

- `Job status (pending, in progress, completed, failed)` (string)
- `Job logs and result summaries` (string)

**Sources**: code_chunks

---

### SQS Integration Contract

**Purpose**: Defines the structure and semantics of pattern job messages exchanged with AWS SQS.

**Inputs**:

- `Pattern job messages with all required parameters` (string) - **required**

**Outputs**:

- `Acknowledgment of message receipt and processing` (string)
- `Error messages on validation or processing failure` (string)

**Sources**: code_chunks

---

### Cloud Storage and FTP Upload Contracts

**Purpose**: Defines how pattern packages are uploaded to S3 and FTP endpoints, including authentication, file naming, and notification.

**Inputs**:

- `Compiled and archived pattern packages` (string) - **required**

**Outputs**:

- `Confirmation of successful upload` (string)
- `Error or retry logs on failure` (string)

**Sources**: code_chunks

---

### Notification Email Contract

**Purpose**: Specifies the content and triggers for notification emails sent upon package upload and job completion.

**Inputs**:

- `Job result data (success/failure, versions, branch, etc.)` (string) - **required**

**Outputs**:

- `Structured notification emails to configured recipients` (string)

**Sources**: code_chunks

---

## User Stories

## System Invariants

- Version Consistency Enforcement: The system enforces that the versions of TBL and OTH pattern packages on the Active Update (AU) server exactly match those in the PSMS database for the last 14 versions. This includes validating both the count and the actual version strings, and ensuring that every version pair aligns before proceeding.
- Rolling Package Retention Policy: The system maintains only the latest 14 versions of each pattern package type (TBL and OTH) in local storage. When new packages are downloaded, older ones are deleted to enforce this rolling window.
- SHA1 Integrity Validation for Downloads: Before downloading a package from S3, the system checks if a local file with the same SHA1 hash exists. If so, the download is skipped, optimizing bandwidth and ensuring file integrity.
- Branch Rollback Identification: Branches with IDs &gt;&#x3D; 61 are treated as rollback branches, and the original branch ID is computed as branchID - 60. This affects how pattern jobs are processed and which data sources are used.
- High-Priority Job Routing: Jobs marked as high-priority are routed to a dedicated SQS queue and processed on high-performance compute instances (e.g., c5.4xlarge).
- Command Dependency and Conditional Execution: Each build command declares explicit dependencies (waitFor) and conditional execution rules (condition) based on job parameters such as branch, release type, and rollback status. Commands execute only when dependencies are satisfied and conditions are met.
- The system is built around a pipeline orchestration model, where jobs are processed in discrete, well-defined phases, each with clear entry and exit criteria.
- CommandFlow provides a declarative, data-driven approach to workflow orchestration, enabling dynamic reconfiguration and extension of build steps without code changes.
- The use of dependency and condition maps for commands allows for highly flexible, parallel, and environment-specific execution, supporting a wide variety of product branches and release types.
- Integration with AWS SQS, S3, and FTP is abstracted via configuration, supporting multi-environment deployments (dev, staging, prod, DR) with minimal code changes.
- The system enforces strong invariants around data integrity (version matching, SHA1 validation), reflecting the criticality of pattern correctness in security scanning.

---

## Source Citations

- **claude_md**: CLAUDE.md (analyzed via code chunks and LLM) (retrieved 2026-02-09T20:49:43.309Z)
- **code_chunks**: 249 code chunks analyzed by GPT-4 for System Architecture (retrieved 2026-02-09T20:49:43.309Z)
