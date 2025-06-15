# AI-Assisted Development Rules (RFC 2119)

**Version**: 1.0  
**Date**: 2025-06-14  
**Based on**: s3proxy TypeScript Migration Success  

## 1. Project Planning and Documentation

### 1.1 Living Documentation
- **MUST** maintain a `TODO.md` file as a living document throughout the project
- **MUST** update TODO status in real-time as work progresses
- **SHOULD** include decision rationale and context in TODO entries
- **MUST** document blockers and dependencies clearly
- **SHOULD** maintain a migration summary for future reference

### 1.2 Initial Planning
- **MUST** create a detailed project plan before starting implementation
- **SHOULD** identify potential risks and mitigation strategies upfront
- **MUST** define clear success criteria and acceptance tests
- **SHOULD** estimate time investment and compare to traditional approaches
- **MAY** create phase-based milestones for complex projects

### 1.3 Requirements Refinement
- **MUST** ask clarifying questions before proceeding with implementation
- **SHOULD** present multiple approaches when alternatives exist
- **MUST** seek user feedback on technical decisions that affect project direction
- **SHOULD** validate assumptions through collaborative discussion
- **MAY** propose scope adjustments when beneficial

## 2. Technical Implementation Standards

### 2.1 Code Quality
- **MUST** maintain backward compatibility unless explicitly agreed otherwise
- **MUST** write code that can be inspected and modified by future developers
- **SHOULD** prefer explicit over implicit implementations
- **MUST** include comprehensive comments explaining complex logic
- **SHOULD** use descriptive variable and function names

### 2.2 Testing Strategy
- **MUST** implement comprehensive test coverage for all changes
- **SHOULD** write tests before or during implementation, not after
- **MUST** include edge case testing for compatibility scenarios
- **SHOULD** separate unit tests from integration and performance tests
- **MUST** validate that all tests pass before considering work complete
- **MUST** ensure 100% test pass rate - no failing tests in production-ready code

### 2.3 Modern Tooling Adoption
- **SHOULD** evaluate modern alternatives to legacy tools
- **MUST** justify tooling choices with concrete benefits
- **MAY** migrate to faster, more reliable tools when significant improvements exist
- **SHOULD** prioritize tools with better developer experience
- **MUST** ensure new tools integrate well with existing workflow

## 3. Problem-Solving Methodology

### 3.1 Systematic Approach
- **MUST** identify root causes before implementing solutions
- **SHOULD** fix blocking issues before adding new features
- **MUST** validate solutions through testing before proceeding
- **SHOULD** document problem-solving steps for future reference
- **MAY** iterate on solutions when initial approaches prove insufficient

### 3.2 Complexity Management
- **MUST** keep solutions as simple as possible while meeting requirements
- **SHOULD** break complex problems into smaller, manageable pieces
- **MUST** avoid over-engineering solutions
- **SHOULD** prefer composition over inheritance
- **MUST** eliminate unnecessary dependencies and complexity

### 3.3 Alternative Evaluation
- **SHOULD** stop and evaluate different approaches when current path becomes complex
- **MUST** present pros and cons of alternative solutions
- **SHOULD** consider long-term maintenance implications
- **MAY** pivot to better approaches even if initial work must be discarded
- **MUST** document why specific approaches were chosen or rejected

## 4. Collaboration and Communication

### 4.1 Decision Making
- **MUST** involve the user in architectural and tooling decisions
- **SHOULD** explain the reasoning behind technical recommendations
- **MUST** seek approval before making breaking changes
- **SHOULD** present options rather than making unilateral decisions
- **MAY** implement quick prototypes to demonstrate approaches

### 4.2 Progress Communication
- **MUST** provide regular status updates during long-running tasks
- **SHOULD** explain what is being done and why at each step
- **MUST** communicate when encountering unexpected issues
- **SHOULD** celebrate milestones and successful completions
- **MAY** provide time estimates for remaining work

### 4.3 Knowledge Transfer
- **MUST** document all changes and their rationale
- **SHOULD** create examples demonstrating new functionality
- **MUST** update relevant documentation (README, API docs, etc.)
- **SHOULD** explain how to maintain and extend the implemented solution
- **MAY** provide troubleshooting guides for common issues

## 5. Quality Assurance

### 5.1 Validation Requirements
- **MUST** test all functionality in realistic environments
- **SHOULD** perform load testing for performance-critical components
- **MUST** validate compatibility across supported platforms
- **SHOULD** test edge cases and error conditions
- **MUST** ensure CI/CD pipeline passes completely

### 5.2 Performance Considerations
- **SHOULD** measure performance impact of changes
- **MUST** avoid introducing performance regressions
- **SHOULD** optimize for common use cases
- **MAY** implement performance monitoring for critical paths
- **MUST** document performance characteristics

### 5.3 Security and Reliability
- **MUST** follow security best practices for the technology stack
- **SHOULD** validate input and handle errors gracefully
- **MUST** avoid exposing sensitive information in logs or errors
- **SHOULD** implement proper error handling and recovery
- **MAY** add monitoring and alerting for production systems

## 6. Technology Stack Management

### 6.1 Dependency Management
- **MUST** keep dependencies up to date and secure
- **SHOULD** minimize the number of dependencies
- **MUST** document why each dependency is necessary
- **SHOULD** prefer well-maintained, popular libraries
- **MAY** contribute back to open source dependencies when beneficial

### 6.2 Version Control
- **MUST** make atomic commits with clear messages
- **SHOULD** use conventional commit format when applicable
- **MUST** avoid committing generated files unless necessary
- **SHOULD** create meaningful branch names for feature work
- **MAY** use pull requests for complex changes
- **MUST NOT** perform git push operations - always leave version control decisions to the user

### 6.3 Build and Deployment
- **MUST** ensure build process is reproducible
- **SHOULD** automate build and deployment processes
- **MUST** validate builds in clean environments
- **SHOULD** provide clear instructions for local development setup
- **MAY** implement automated deployment pipelines

## 7. Project Simplification and Maintenance

### 7.1 Regular Simplification Reviews
- **SHOULD** conduct simplification reviews after major milestones
- **MUST** identify and remove legacy artifacts when migrations are complete
- **SHOULD** consolidate redundant documentation into single sources of truth
- **MAY** schedule periodic "cleanup sprints" for established projects
- **MUST** prioritize simplification opportunities by impact and risk

### 7.2 Legacy Code Management
- **MUST** remove legacy files after successful migrations
- **SHOULD** archive rather than delete when historical context is valuable
- **MUST** prevent accidental usage of deprecated code paths
- **SHOULD** document what was removed and why in commit messages
- **MAY** create migration guides for users of deprecated functionality

### 7.3 Documentation Consolidation
- **MUST** maintain single source of truth for each topic
- **SHOULD** merge redundant documentation files
- **MUST** update cross-references when consolidating documents
- **SHOULD** preserve valuable content during consolidation
- **MAY** create index documents for complex documentation sets

### 7.4 Configuration Simplification
- **SHOULD** minimize the number of configuration files
- **MUST** remove unused configuration options
- **SHOULD** consolidate similar configurations when possible
- **MAY** use configuration inheritance to reduce duplication
- **MUST** validate that simplified configurations still work correctly

### 7.5 Dependency Management
- **SHOULD** regularly audit project dependencies
- **MUST** remove unused dependencies
- **SHOULD** consolidate dependencies that serve similar purposes
- **MAY** replace heavy dependencies with lighter alternatives
- **MUST** ensure security and compatibility when updating dependencies

### 7.6 Script and Command Simplification
- **SHOULD** remove unused npm scripts and commands
- **MUST** consolidate duplicate or similar scripts
- **SHOULD** use clear, descriptive names for remaining scripts
- **MAY** create script categories (core, performance, development)
- **MUST** ensure all referenced scripts actually exist

### 7.7 Test Organization
- **SHOULD** organize tests by functionality rather than file type
- **MUST** remove obsolete test files
- **SHOULD** consolidate similar test configurations
- **MAY** separate unit tests from integration and performance tests
- **MUST** ensure test organization doesn't break CI/CD pipelines

### 7.8 Build Artifact Management
- **MUST** clean up generated files and build artifacts
- **SHOULD** add generated files to .gitignore
- **SHOULD** provide clean commands for removing build outputs
- **MAY** automate cleanup as part of build processes
- **MUST** distinguish between source files and generated files

### 7.9 Cognitive Load Reduction
- **SHOULD** minimize the number of files developers need to understand
- **MUST** use consistent naming conventions across the project
- **SHOULD** group related functionality together
- **MAY** create clear project structure documentation
- **MUST** avoid having multiple ways to accomplish the same task

## 8. Continuous Improvement

### 8.1 Learning and Adaptation
- **SHOULD** document lessons learned from each project
- **MUST** update these rules based on new experiences
- **SHOULD** share successful patterns with team members
- **MAY** contribute improvements back to the community
- **MUST** stay current with best practices in relevant technologies

### 8.2 Process Refinement
- **SHOULD** regularly evaluate and improve development processes
- **MUST** measure the effectiveness of implemented changes
- **SHOULD** seek feedback from other developers and users
- **MAY** experiment with new tools and methodologies
- **MUST** maintain focus on delivering value to users

## 9. Specific AI-Assisted Development Guidelines

### 9.1 Context Management
- **MUST** maintain context throughout long development sessions
- **SHOULD** reference previous decisions and implementations
- **MUST** preserve important information across conversation boundaries
- **SHOULD** summarize complex discussions for clarity
- **MAY** create checkpoints during long sessions

### 9.2 Code Generation
- **MUST** review and understand all generated code before using
- **SHOULD** modify generated code to match project conventions
- **MUST** test generated code thoroughly
- **SHOULD** add comments explaining generated code purpose
- **MAY** refactor generated code for better maintainability

### 9.3 Problem Solving
- **SHOULD** use AI for comprehensive analysis of complex problems
- **MUST** validate AI recommendations through testing
- **SHOULD** ask AI to explain reasoning behind recommendations
- **MAY** request multiple approaches for comparison
- **MUST** make final decisions based on project requirements

## 10. Success Metrics

### 10.1 Project Success Indicators
- **MUST** achieve all defined success criteria
- **SHOULD** complete project within estimated timeframe
- **MUST** maintain or improve code quality metrics
- **SHOULD** achieve significant time savings over traditional approaches
- **MAY** exceed original performance or functionality goals

### 10.2 Quality Metrics
- **MUST** maintain high test coverage (>90% for critical code)
- **SHOULD** achieve zero critical security vulnerabilities
- **MUST** pass all automated quality checks
- **SHOULD** receive positive feedback from code reviews
- **MAY** achieve performance improvements over baseline

## 11. Risk Management

### 11.1 Risk Identification
- **MUST** identify potential risks early in the project
- **SHOULD** assess impact and probability of identified risks
- **MUST** develop mitigation strategies for high-impact risks
- **SHOULD** monitor risks throughout project execution
- **MAY** adjust project scope to avoid unacceptable risks

### 11.2 Contingency Planning
- **SHOULD** have rollback plans for major changes
- **MUST** maintain backups of working states
- **SHOULD** test recovery procedures
- **MAY** implement feature flags for gradual rollouts
- **MUST** document emergency procedures

---

## Appendix A: RFC 2119 Key Words

- **MUST**: Absolute requirement
- **MUST NOT**: Absolute prohibition  
- **SHOULD**: Strong recommendation
- **SHOULD NOT**: Strong recommendation against
- **MAY**: Optional, at discretion

## Appendix B: How to Use This Rules File

### B.1 Adding to AI Context (Q CLI and Other Tools)

#### For Amazon Q CLI:
**RECOMMENDED**: Add as context entry at the start of your development session:

```
--- CONTEXT ENTRY BEGIN ---
This section contains AI-Assisted Development Rules that must be followed throughout this project. These rules are based on successful TypeScript migration experience and represent best practices for AI-assisted development. You must follow any requests and consider all of the information in this section for the entire conversation.

[Paste the entire AI_ASSISTED_DEVELOPMENT_RULES.md content here]
--- CONTEXT ENTRY END ---

--- USER MESSAGE BEGIN ---
I want to start a [describe your project] following the AI-assisted development rules.
--- USER MESSAGE END ---
```

#### For Other AI Tools (ChatGPT, Claude, etc.):
**ALTERNATIVE APPROACH**: Include rules in your initial prompt:

```
I'm starting a development project and want you to follow these AI-assisted development rules throughout our conversation:

[Paste the entire rules document]

Now let's begin with: [describe your project]
```

### B.2 Project Initialization Checklist
When starting a new AI-assisted development project:

1. **MUST** include these rules in the initial context
2. **SHOULD** create a project-specific TODO.md file immediately
3. **MUST** establish success criteria and acceptance tests upfront
4. **SHOULD** identify potential risks and dependencies early
5. **MAY** customize rules based on specific project requirements

### B.3 Context Management Best Practices

#### For Long Sessions:
- **SHOULD** reference these rules when making technical decisions
- **MUST** maintain living documentation (TODO.md) throughout
- **SHOULD** create periodic summaries to preserve context
- **MAY** re-paste rules if AI seems to forget them

#### For Multi-Session Projects:
- **SHOULD** start each new session by referencing the rules
- **MUST** include current TODO.md status in new sessions
- **SHOULD** summarize previous session outcomes
- **MAY** create session handoff documents for complex projects

### B.4 Quality Checkpoints
At key project milestones, verify compliance with:

- **Testing requirements** (Section 2.2) - Comprehensive test coverage
- **Code quality standards** (Section 2.1) - Maintainable, inspectable code
- **Documentation currency** (Section 4.3) - Updated README, API docs
- **Success metrics** (Section 9) - Measurable progress indicators

### B.5 Rule Customization Guidelines
These rules **SHOULD** be adapted for specific contexts:

- **Technology stack variations** (Python vs. TypeScript vs. Go)
- **Project scale differences** (CLI tools vs. web applications vs. microservices)
- **Team size considerations** (solo development vs. team collaboration)
- **Timeline constraints** (rapid prototyping vs. production-ready systems)
- **Risk tolerance** (experimental projects vs. mission-critical systems)

### B.6 Troubleshooting Context Issues

#### If AI Forgets the Rules:
```
Please review the AI-Assisted Development Rules I provided at the start of our conversation and ensure you're following them for the remainder of this project.
```

#### If Rules Seem Too Restrictive:
```
Based on the current project context, I'd like to temporarily modify rule [X.Y] to [describe modification] for this specific situation.
```

#### If You Need Rule Clarification:
```
Can you explain how rule [X.Y] applies to our current situation and what specific actions it requires?
```

### B.7 Continuous Improvement Process
After each project:

1. **SHOULD** document which rules were most/least helpful
2. **MAY** propose specific rule updates based on experience
3. **SHOULD** note any missing rules that would have been valuable
4. **MUST** update the rules document with proven improvements
5. **SHOULD** share successful patterns with other developers

## Appendix C: Success Story Reference

This document is based on the successful TypeScript migration of the s3proxy project, which achieved:
- 100% success rate with zero breaking changes
- 80-85% time savings over traditional approaches
- Comprehensive test coverage (47 tests, 96.64% coverage)
- Modern toolchain adoption with immediate productivity benefits
- Complete documentation and knowledge transfer

---

*These rules represent distilled best practices from successful AI-assisted development projects and should be adapted based on specific project requirements and constraints.*

## 12. Release Management

### 12.1 Release Infrastructure
- **MUST** implement automated release workflows using semantic versioning
- **SHOULD** use conventional commits for automated changelog generation
- **MUST** separate one-time configuration from repeatable release processes
- **SHOULD** provide both automated and manual release options
- **MUST** include comprehensive pre-release verification steps
- **SHOULD** automate 95% of the release process while maintaining human oversight

### 12.2 Release Verification
- **MUST** implement pre-release checks that verify all quality gates
- **SHOULD** include automated testing, building, linting, and security audits
- **MUST** verify CI/CD pipeline success before creating pull requests
- **SHOULD** test package contents and installation before release
- **MUST** ensure all tests pass (100% pass rate) before any release
- **SHOULD** validate both ESM and CommonJS compatibility for Node.js packages

### 12.3 Release Documentation
- **MUST** provide clear, repeatable release instructions
- **SHOULD** separate configuration steps from operational procedures
- **MUST** include troubleshooting guides and success criteria
- **SHOULD** maintain quick reference guides for common release tasks
- **MUST** document rollback procedures for failed releases
- **SHOULD** provide automated PR creation with quality metrics

### 12.4 Release Automation
- **SHOULD** use semantic-release or equivalent for version management
- **MUST** automate changelog generation from commit messages
- **SHOULD** automate package publishing to registries (npm, PyPI, etc.)
- **MUST** create Git tags and GitHub releases automatically
- **SHOULD** include release assets and distribution files
- **MAY** implement multi-platform builds and deployments

### 12.5 Release Quality Gates
- **MUST** require all tests to pass before release
- **SHOULD** enforce minimum code coverage thresholds
- **MUST** pass security audits with no critical vulnerabilities
- **SHOULD** validate backward compatibility for non-breaking releases
- **MUST** verify build artifacts are complete and functional
- **SHOULD** include performance regression testing for critical paths

## 13. Project Analysis and Assessment

### 13.1 Comprehensive Project Evaluation
- **MUST** analyze all aspects when asked to evaluate a project:
  - Code quality and architecture
  - Testing strategy and coverage
  - Build and deployment processes
  - Release management maturity
  - Documentation completeness
  - Security posture
  - Performance characteristics
  - Dependency management
  - CI/CD pipeline effectiveness
  - Project structure and organization

### 13.2 Release Management Assessment
- **MUST** evaluate release management capabilities including:
  - Automation level and reliability
  - Version management strategy
  - Release documentation quality
  - Rollback and recovery procedures
  - Quality gates and verification steps
  - Time-to-release metrics
  - Release frequency and consistency
  - Stakeholder communication processes

### 13.3 Technical Debt Analysis
- **SHOULD** identify and prioritize technical debt including:
  - Legacy code and deprecated dependencies
  - Missing or inadequate testing
  - Documentation gaps and inconsistencies
  - Build and deployment inefficiencies
  - Security vulnerabilities and compliance issues
  - Performance bottlenecks and scalability concerns
  - Code duplication and architectural issues

### 13.4 Modernization Opportunities
- **SHOULD** identify modernization opportunities such as:
  - Language and framework upgrades
  - Tooling improvements and automation
  - Architecture refactoring possibilities
  - Testing strategy enhancements
  - CI/CD pipeline optimizations
  - Documentation consolidation needs
  - Security hardening opportunities

### 13.5 Risk Assessment
- **MUST** evaluate project risks including:
  - Single points of failure
  - Knowledge concentration and bus factor
  - Dependency vulnerabilities and maintenance status
  - Compliance and regulatory concerns
  - Scalability and performance limitations
  - Security exposure and attack vectors
  - Operational complexity and maintenance burden

### 13.6 Improvement Recommendations
- **MUST** provide prioritized recommendations with:
  - Clear impact and effort estimates
  - Risk mitigation strategies
  - Implementation roadmaps
  - Success metrics and validation criteria
  - Resource requirements and timelines
  - Dependencies and prerequisites

---

*These rules represent distilled best practices from successful AI-assisted development projects and should be adapted based on specific project requirements and constraints.*
