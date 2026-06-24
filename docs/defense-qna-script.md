# Capstone Defense Q&A Script: LeadCRM for Camxian Technologies

**Client:** Camxian Technologies (https://camxian.com/)

---

### 1. What is the main purpose of your system?
**Answer:**
The main purpose of LeadCRM is to provide a customized, all-in-one SaaS-based Customer Relationship Management platform. It exists to solve the problem of disorganized lead tracking by connecting scattered client data, communications, and sales processes into one centralized, secure, and easy-to-use system.

### 2. What specific problem are you solving?
**Answer:**
Based on our interviews and discussions with Camxian Technologies, they experienced significant issues with scattered data, delayed client follow-ups, and manual tracking using spreadsheets. This led to lost sales opportunities and duplicate records. Our system solves this by centralizing all lead data, validating entries automatically to prevent duplicates, and providing real-time tracking so no potential client falls through the cracks.

### 3. What problem does LeadCRM solve that existing CRM systems do not?
**Answer:**
Existing CRM systems on the market are often too complex, overly expensive, and not fully localized. LeadCRM solves this by providing a targeted solution that fits the exact workflow of Camxian without the overwhelming bloat of unused features. Furthermore, it strictly integrates deep localization, such as native compliance with the Philippine Data Privacy Act of 2012, Philippine Peso default formatting, and seamless integration with PayMongo for local transactions.

### 4. Why did you choose to develop your system as a SaaS-based CRM instead of a traditional on-premise system?
**Answer:**
We chose a SaaS-based model because it is highly accessible, scalable, and cost-effective. Unlike on-premise systems that require expensive physical servers and manual maintenance, SaaS allows Camxian's team to access the CRM securely from anywhere using any web browser. It also allows us to push hot-updates, security patches, and automated backups without causing system downtime for the users.

### 5. How is your system different from well-known CRM platforms like Salesforce CRM or HubSpot CRM?
**Answer:**
While Salesforce and HubSpot are extremely powerful, they cater to a massive global audience which makes them overwhelming and expensive for local tech agencies. LeadCRM is tailored specifically for Camxian's actual needs. It removes unnecessary complex features to reduce the learning curve, natively integrates with Philippine-based payment gateways like PayMongo, and naturally complies with local telecom and data privacy regulations.

### 6. Who are the target users and why?
**Answer:**
Our target users are specific departments within Camxian Technologies:
1. **Sales and Marketing Teams:** They will use the system daily to import leads, track sales pipelines, and automate prospect communications.
2. **Customer Support:** To handle ongoing client interactions and manage tickets or inquiries smoothly.
3. **Management / Administrators:** To monitor real-time dashboard analytics, configure system settings, and oversee the audit trails for employee accountability.

### 7. Why did you choose Camxian Technologies as your case study?
**Answer:**
We chose Camxian Technologies because they are an actively growing tech company managing multiple digital projects, but their internal lead management was becoming a bottleneck. Their real-world challenges with tracking client communications, scattered files, and proposals provided a perfect, highly valid use-case for us to develop a streamlined, customized CRM solution.

### 8. Can you explain the overall architecture of your system (front-end, back-end, database)?
**Answer:**
Our system uses a modern, layered scalable architecture. The **front-end** is built using Next.js, providing a fast, responsive user interface. The **back-end** is powered by Node.js and Express.js to cleanly handle API requests and complex business logic. For the **database**, we use PostgreSQL, a highly robust relational database, to properly manage structured relationships between users, leads, and payments.

### 9. Why did you choose Next.js for the frontend?
**Answer:**
We chose Next.js because of our team's familiarity with the framework, which ensures fast and confident development. Next.js provides excellent performance out-of-the-box through features like Server-Side Rendering (SSR) and seamless routing. It is perfectly suited for building responsive, enterprise-grade web applications with a polished user experience, strictly aligning with our operational requirements.

### 10. What are the advantages of using Node.js and Express.js in your backend?
**Answer:**
Node.js and Express.js allow us to use a single programming language (JavaScript/TypeScript) across both the front-end and back-end, heavily streamlining our development process. Express.js is highly flexible and lightweight, making it incredibly fast for building robust RESTful APIs. It effortlessly handles multiple concurrent user requests—meeting our requirement for smooth access for our users without performance degradation.

### 11. Why did you choose PostgreSQL instead of NoSQL databases like MongoDB?
**Answer:**
We chose PostgreSQL because a CRM system inherently requires strict data relationships and integrity (for example, strictly linking a lead to a sales agent and a payment transaction). PostgreSQL is a powerful relational database that supports complex queries, strict schemas, and ACID compliance, meaning our financial and client data remains highly structured, secure, and perfectly consistent.

### 12. How does your system ensure scalability as more companies subscribe?
**Answer:**
Our SaaS architecture cleanly separates the frontend, backend, and database layers. By using Node.js, we can asynchronously process numerous concurrent actions. Our PostgreSQL database is logically designed to support multi-tenancy (keeping different company data secure and separate). This modular code ensures we can confidently upgrade our cloud infrastructure seamlessly to support at least 1,000 active users per organization while strictly maintaining rapid 2-second response times.

### 13. What methodology did you use?
**Answer:**
We are utilizing the **Agile Methodology**. Since business workflows and software needs can pivot, Agile allows us to split the development cycle into iterative phases called sprints. We chose this because it allows us to continuously gather feedback from Camxian Technologies, adapt swiftly to their changing requirements, and deliver functional modules of the system faster rather than waiting until the very end.

### 14. Why did you choose Agile over Waterfall?
**Answer:**
The Waterfall methodology limits flexibility because you cannot easily go backward once a phase is marked complete. We chose Agile because CRM requirements often naturally evolve as the client starts seeing the project visually. Agile allows us to happily embrace changes, test components early, and constantly improve the system, completely reducing the risk of building a solution the client doesn't actually want to adopt.

### 15. Can you explain your system flow?
**Answer:**
The simple user journey flow looks like this:
1. An employee securely logs in and is redirected to their specific dashboard based on their role within 5 seconds.
2. They input a new lead manually or import a CSV; the system immediately checks for duplicates.
3. The employee moves the lead through sales stages using the visual drag-and-drop Pipeline.
4. As the deal progresses, they easily trigger automated emails or SMS directly from the platform.
5. Once a deal is won, a secure PayMongo payment link is dispatched.
6. The entire time, the system silently records all of these actions in an uneditable audit trail for management tracking.

### 16. What are the limitations of your system?
**Answer:**
Currently, our system does not include a full-scale accounting or ERP module; it focuses purely on lead management and processes payments strictly via PayMongo. It also relies heavily on stable internet connectivity for core automated features like sending SMS/Email messages. However, these limitations can be seamlessly expanded and improved in future modular updates.

### 17. What makes your system unique?
**Answer:**
Our system’s absolute biggest edge is that it is a dedicated, hyper-localized CRM for the Philippine business market. It inherently understands and complies with the Data Privacy Act of 2012, formats cleanly for Philippine Pesos and local business hours by default, uses local payment gateways like PayMongo, and offers a highly focused toolset without the confusing bloat of massive international CRMs.

### 18. What are pipelines in CRM?
**Answer:**
Pipelines are visual, structural representations of the actual sales process. They are broken down into progressive stages (like "New Lead", "Contacted", "Proposal Sent", and "Closed"). They exist to allow sales teams and managers to instantly and visually see exactly where every potential client stands in the buying journey, making it incredibly easy to track progress and manage deals efficiently.

### 19. What are the benefits of PWA compared to native mobile apps?
**Answer:**
A Progressive Web App (PWA) functions and feels much like a native app, but it completely removes the friction of forcing users to download heavy files from an App Store. It is entirely cross-platform, meaning it works beautifully on iOS, Android, and Desktop browsers. It uses minimal storage, stays up-to-date instantly and automatically, and significantly reduces our development costs and time.

### 20. Can your system work offline? Why or why not?
**Answer:**
Because our system is a PWA, it possesses basic offline capabilities via browser service workers. Users can securely view cached dashboard data and safely queue minor offline actions. However, core functionalities—like sending triggered SMS, fully syncing new leads, and securely processing PayMongo transactions—strictly require an active internet connection to communicate safely with the database and third-party APIs. Actions in the offline queue sync safely once the connection is restored.

### 21. How do you protect sensitive customer data from unauthorized access?
**Answer:**
We relentlessly protect data using a strict multi-layered approach. We enforce Role-Based Access Control (RBAC) so users legally only see their designated data. Passwords are securely hashed via complex algorithms before storing them, and accounts are automatically locked after 5 failed attempts. Furthermore, accidental data loss is prevented by mandatory pop-up confirmations, and we maintain a complete, uneditable audit trail to track everything.

### 22. What is the difference between sandbox and production accounts?
**Answer:**
A **Sandbox account** is a completely safe, isolated testing environment. Developers and users can test new features, explore integrations (like doing mock fake payments), and train new employees safely without affecting any real business data. The **Production account** is the live, active system strictly where real client data is stored, and real, binding financial transactions occur.

### 23. How does subscription billing work in your system?
**Answer:**
As a SaaS platform, our subscription billing model charges client organizations a recurring fee (for example, monthly or annually) to access the CRM platform. The system cleanly manages these recurring charges via secure API integrations. As long as the company maintains their active subscription, their access is uninterrupted. If a subscription officially expires or fails, the system automatically restricts full access to the platform until the renewal payment succeeds.
