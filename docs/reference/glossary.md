# Glossary

This glossary provides definitions for key terms, concepts, and technologies used throughout the TensorNode ecosystem.

## A

**Agent**
An AI-powered system that can autonomously execute tasks, make decisions, and interact with various services on behalf of users. In TensorNode, agents can deploy VMs, manage resources, and coordinate network operations.

**API (Application Programming Interface)**
A set of protocols, routines, and tools for building software applications. TensorNode provides REST APIs for programmatic access to network functionality.

**API Key**
A unique identifier used to authenticate requests to external services like Fluence, OpenAI, or other AI providers.

**Autonomous Mode**
An operational mode where the TensorNode agent can automatically sign transactions and execute operations without human intervention, using pre-configured private keys.

## B

**Backend**
The server-side component of TensorNode, implemented in Python Flask, that handles VM management, validation processing, and blockchain integration.

**Blockchain**
A distributed ledger technology that maintains a continuously growing list of records (blocks) that are linked and secured using cryptography. TensorNode uses Hedera's blockchain for consensus and smart contracts.

**Bootstrap**
The initial configuration and setup process for TensorNode components, including network selection, key management, and service initialization.

## C

**Candidate Answer**
A response provided by a miner to a validation query, which is then scored against the ground truth or expected answer.

**Consensus**
The process by which distributed network participants agree on the validity of transactions and the current state of the network. Hedera uses a unique consensus algorithm called Hashgraph.

**Container**
A lightweight, standalone package that includes everything needed to run an application: code, runtime, system tools, libraries, and settings. TensorNode uses Docker containers to isolate AI models.

**Contract ID**
A unique identifier for a smart contract deployed on the Hedera network, typically in the format `0.0.123456`.

## D

**Decentralization**
The distribution of functions, powers, people, or things away from a central location or authority. TensorNode operates as a decentralized network without single points of failure.

**Deployment**
The process of making software applications or services available for use. In TensorNode, this includes deploying VMs, smart contracts, and AI models.

**Docker**
A platform that uses containerization to package applications and their dependencies into portable containers that can run consistently across different environments.

**Dockerfile**
A text file containing instructions for building a Docker image, specifying the base image, dependencies, configuration, and commands needed to run an application.

## E

**ECDSA (Elliptic Curve Digital Signature Algorithm)**
A cryptographic algorithm used for digital signatures. TensorNode requires ECDSA keys for autonomous transaction signing on Hedera.

**Endpoint**
A specific URL where an API can be accessed by a client application. TensorNode provides various endpoints for VM management, validation, and blockchain interaction.

**Environment Variables**
Configuration values stored outside of application code, used to customize behavior across different deployment environments (development, staging, production).

## F

**Flask**
A lightweight Python web framework used to build TensorNode's backend API server.

**Fluence**
A decentralized cloud computing platform that provides the virtual machine infrastructure for TensorNode miners.

**Frontend**
The client-side component of TensorNode, built with Next.js and React, that provides the user interface for miners, validators, and network participants.

## G

**Ground Truth**
The correct or expected answer to a validation query, used as a reference point for scoring miner responses.

**Gas**
The computational effort required to execute operations on a blockchain network. On Hedera, gas costs are typically lower than other blockchain networks.

## H

**HBAR**
The native cryptocurrency of the Hedera network, used to pay for transactions, smart contract execution, and network services.

**HCS (Hedera Consensus Service)**
A service that provides fast, fair, and secure consensus for any application that needs to track events or messages in a verifiable order.

**Hedera**
A public distributed ledger platform that uses a unique consensus algorithm called Hashgraph, providing fast, fair, and secure consensus.

**Hedera Agent Kit**
A toolkit that enables AI agents to interact with the Hedera network, including account management, token operations, and smart contract interactions.

**HITL (Human-in-the-Loop)**
An operational mode where human approval is required for certain operations, particularly transaction signing and critical decisions.

**Hashgraph**
The consensus algorithm used by Hedera that provides asynchronous Byzantine Fault Tolerance (aBFT) with fast finality and low energy consumption.

## I

**Instance**
A running virtual machine or container that hosts an AI model and provides API endpoints for processing requests.

**Instance Registry**
A smart contract that tracks and manages miner registrations, subnet memberships, and instance states across the TensorNode network.

## J

**JSON (JavaScript Object Notation)**
A lightweight data interchange format that is easy for humans to read and write, commonly used for API requests and responses.

**JWT (JSON Web Token)**
A compact, URL-safe means of representing claims to be transferred between two parties, often used for authentication and authorization.

## L

**LLM (Large Language Model)**
A type of AI model trained on vast amounts of text data to understand and generate human-like text. Examples include GPT, Claude, and LLaMA.

**Load Balancer**
A system that distributes incoming network traffic across multiple servers to ensure no single server becomes overwhelmed.

## M

**Miner**
A network participant who provides computational resources by running AI models on virtual machines and processing inference requests.

**Minting**
The process of creating new tokens on a blockchain network. In TensorNode, tokens are minted as rewards for network participants.

**Multimodal AI**
AI systems that can process and understand multiple types of data inputs (text, images, audio, video) simultaneously.

## N

**Network**
In blockchain context, refers to the specific blockchain environment (mainnet, testnet) where transactions and smart contracts are executed.

**Next.js**
A React framework that provides features like server-side rendering, static site generation, and API routes, used for TensorNode's frontend.

**Node**
A computer or server that participates in a blockchain network by maintaining a copy of the distributed ledger and validating transactions.

## O

**Ollama**
An open-source platform for running large language models locally, supported as an AI provider option in TensorNode.

**OpenAI**
An AI research company that provides API access to language models like GPT-4, used for response scoring and AI capabilities in TensorNode.

## P

**Private Key**
A secret cryptographic key that allows the holder to sign transactions and prove ownership of a blockchain account.

**Public IP**
An IP address that is accessible from the internet, assigned to VMs to allow external access to hosted AI models.

**Public Key**
A cryptographic key that can be shared publicly and is used to verify digital signatures created with the corresponding private key.

## Q

**Query**
A request or question submitted to the network for processing by AI models, typically used in the validation process.

## R

**REST API**
Representational State Transfer API - an architectural style for designing networked applications using standard HTTP methods.

**Redis**
An in-memory data structure store used for caching, session management, and real-time data processing in TensorNode.

**Response Time**
The time taken for a system to respond to a request, used as a performance metric for scoring miner quality.

## S

**Scoring**
The process of evaluating and rating miner responses based on accuracy, relevance, speed, and other quality metrics.

**SDK (Software Development Kit)**
A collection of software development tools, libraries, and documentation that enables developers to build applications for a specific platform.

**Smart Contract**
Self-executing contracts with terms directly written into code, deployed on blockchain networks to automate agreement execution.

**SSH (Secure Shell)**
A cryptographic network protocol for secure communication over an unsecured network, used to access and manage VMs remotely.

**Subnet**
A logical subdivision of the TensorNode network that groups miners by AI model type or capability (e.g., LLM, Vision, Speech).

## T

**Testnet**
A test blockchain network used for development and testing purposes, where transactions don't involve real value.

**Token**
A digital asset created and managed on a blockchain network, used for various purposes including rewards, governance, and value transfer.

**Topic**
In Hedera Consensus Service, a topic is a stream of messages that provides an immutable log of events with consensus timestamps.

**Transaction**
An operation that changes the state of a blockchain network, such as transferring tokens or executing smart contract functions.

## U

**Uptime**
The percentage of time that a system or service is operational and available, used as a reliability metric for miners.

**URL (Uniform Resource Locator)**
A web address that specifies the location of a resource on the internet, used to access API endpoints and services.

## V

**Validator**
A network participant who submits queries to test miner performance and scores their responses to maintain network quality.

**Virtual Machine (VM)**
A software emulation of a physical computer that can run operating systems and applications in an isolated environment.

**Vision AI**
Artificial intelligence systems that can analyze and understand visual content such as images and videos.

## W

**Wallet**
A software application or hardware device that stores cryptographic keys and allows users to interact with blockchain networks.

**WalletConnect**
A protocol that connects decentralized applications to mobile wallets through QR code scanning or deep linking.

**WebSocket**
A communication protocol that provides full-duplex communication channels over a single TCP connection, enabling real-time data exchange.

## Acronyms and Abbreviations

- **AI**: Artificial Intelligence
- **API**: Application Programming Interface
- **AWS**: Amazon Web Services
- **CPU**: Central Processing Unit
- **CORS**: Cross-Origin Resource Sharing
- **CSV**: Comma-Separated Values
- **DNS**: Domain Name System
- **GPU**: Graphics Processing Unit
- **HTTP**: Hypertext Transfer Protocol
- **HTTPS**: HTTP Secure
- **IP**: Internet Protocol
- **JSON**: JavaScript Object Notation
- **JWT**: JSON Web Token
- **ML**: Machine Learning
- **NLP**: Natural Language Processing
- **RAM**: Random Access Memory
- **REST**: Representational State Transfer
- **RPC**: Remote Procedure Call
- **SDK**: Software Development Kit
- **SQL**: Structured Query Language
- **SSH**: Secure Shell
- **SSL**: Secure Sockets Layer
- **TCP**: Transmission Control Protocol
- **TLS**: Transport Layer Security
- **UI**: User Interface
- **URL**: Uniform Resource Locator
- **UX**: User Experience
- **VM**: Virtual Machine
- **VPC**: Virtual Private Cloud
- **YAML**: YAML Ain't Markup Language

## Technical Terms

**Asynchronous**
Operations that don't block the execution of other operations, allowing multiple tasks to run concurrently.

**Byzantine Fault Tolerance**
The ability of a distributed system to continue operating correctly even when some nodes fail or act maliciously.

**Containerization**
The practice of packaging applications and their dependencies into containers for consistent deployment across environments.

**Distributed System**
A system whose components are located on different networked computers that communicate and coordinate their actions.

**Immutable**
Data or records that cannot be changed or modified after creation, a key property of blockchain systems.

**Microservices**
An architectural approach where applications are built as a collection of small, independent services.

**Orchestration**
The automated configuration, coordination, and management of computer systems and services.

**Scalability**
The ability of a system to handle increased load by adding resources to the system.

**Throughput**
The amount of work performed by a system in a given period, often measured in requests per second.

---

This glossary serves as a comprehensive reference for understanding the terminology used throughout the TensorNode ecosystem. For additional clarification on any terms, please refer to the relevant documentation sections or contact the development team.
