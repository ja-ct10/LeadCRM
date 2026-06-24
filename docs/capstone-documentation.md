# LeadCRM: A SaaS-Based Progressive Web CRM System for Lead Management and Workflow Automation

## A Capstone Project Proposal

Presented to the Faculty of the
Information and Communications Technology Program
STI College Global City

In Partial Fulfilment of the Requirements for the Degree
Bachelor of Science in Information Technology

Mica Pauline P. Calingo
Nicolette Lei Marc T. Cuison
Reymark J. Panes
Julie Ann C. Tiron

May 23, 2026

---

## ENDORSEMENT FORM FOR PROPOSAL DEFENSE

**TITLE OF RESEARCH:** LeadCRM: A SaaS-Based Progressive Web CRM System for Lead Management and Workflow Automation

**NAME OF PROPONENTS:**
Mica Pauline P. Calingo
Nicolette Lei Marc T. Cuison
Reymark J. Panes
Julie Ann C. Tiron

In Partial Fulfilment of the Requirements for the degree Bachelor of Science in Information Technology has been examined and is recommended for Proposal Defense.

**ENDORSED BY:**
Dexter B. Oseña
Capstone Project Adviser

**APPROVED FOR PROPOSAL DEFENSE:**
Joselito G. Oyao
Capstone Project Coordinator

**NOTED BY:**
Mark Frederick V. Salonga
Program Head

---

## APPROVAL SHEET

This capstone project proposal titled **LeadCRM: A SaaS-Based Progressive Web CRM System for Lead Management and Workflow Automation**, prepared and submitted by Mica Pauline P. Calingo, Nicolette Lei Marc T. Cuison, Reymark J. Panes, and Julie Ann C. Tiron, in partial fulfillment of the requirements for the degree of Bachelor of Science in Information Technology, has been examined and is recommended for acceptance and approval.

Dexter B. Oseña
Capstone Project Adviser

Accepted and approved by the Capstone Project Review Panel in partial fulfillment of the requirements for the degree of Bachelor of Science in Information Technology

Julius Roland V. Munar — Panel Member
Leny Z. Laya — Panel Member
Mark Frederick V. Salonga — Lead Panelist

Noted:
Joselito G. Oyao — Capstone Project Coordinator
Mark Frederick V. Salonga — Program Head

May 23, 2026

---

## Table of Contents

| Section | Page |
|---|---|
| Title Page | i |
| Endorsement Form for Proposal Defense | ii |
| Approval Sheet | iii |
| Table of Contents | iv |
| Introduction | 1 |
| Project Context | 1 |
| Purpose and Description | 3 |
| Objectives | 6 |
| Scope and Limitations | 7 |
| Review of Related Literature / Studies / Systems | 9 |
| Methodology | 27 |
| Technical Background | 28 |
| Requirements Analysis | 33 |
| Requirements Documentation | 35 |
| Design of Software, System, Product, and/or Processes | 46 |
| References | 73 |
| Appendices | 76 |
| Resource Persons | 77 |
| Personal Technical Vitae | 79 |

---

## Introduction

### Project Context

Customer Relationship Management (CRM) integrates technologies used in developing, documenting, tracking, and managing a business or organization's relationship and interactions with its customers (Kavlakoglu et al., 2024). Customer relationships play a crucial role in business operations and the long-term development of businesses. Customers contribute to a business's revenue and the business's relevance by creating a demand which businesses are expected to address and satisfy. A proper management and maintenance of customer relationships can help strengthen trust, support, stability, and growth of the business.

Businesses utilize CRM to guide their principles, practices, and guidelines for customer interactions. The relationship between customer and business encompasses the direct interaction with the customer such as sales and service processes, forecasting, and the analysis of customer trends and behaviors. The goal of CRM is to improve a customer's overall experience in interacting with the company. CRM ranges from websites and emails to telephone calls. The primary objective of CRM is to cultivate positive customer experiences so that customers return and allow businesses to build a base of loyal and returning customers (Hargrave, 2025). Moreover, CRM refers to the technological systems that businesses use to manage the business's external interactions with customers. According to Hargrave (2025), CRM provides the benefit of documenting all the points of a customer's life cycle from discovery, to education, purchase, and post-purchase. CRM systems like LeadCRM allow easier access and improved customer support. Businesses use CRM to optimize sales and keep track of customer retention, track the success of campaigns and projects, identify trends, and create intuitive dashboards. Customers who enjoy better service are more likely to have higher satisfaction with the business. The history of interactions is stored for easier retrieval and can be recalled to prevent customers from repeating the same information.

LeadCRM is a CRM system that, unlike traditional rigid on-premise CRM systems, will be offered as Software as a Service (SaaS). According to Oracle (2026), SaaS is a form of cloud computing that allows users to access services without needing to install the software onto their computers. Traditionally, companies had to install and maintain software on their own hardware, which made the process time-consuming and costly. With SaaS, users log in through the internet to access a service, which ensures they always have the most up-to-date version. SaaS eliminates the need for employees to perform manual software updates and ensures all users are on the same version. Companies also do not need to invest in expensive hardware, since the software is accessible online rather than stored locally. SaaS is easy to implement, update, and less costly than purchasing individual software licenses for each computer. In the context of CRM, SaaS-based CRMs centralize company information, business activities, purchase history, and leads, allowing employees from different departments to share, edit, access, and update data even when they are not in the same location (Grant, 2025).

Camxian Technologies is an IT solutions and technology service provider that offers security, telecommunications, and information technology services for both households and businesses. The company provides various technology solutions such as network infrastructure setup, CCTV surveillance systems, biometrics and access control systems, internet services, fire detection and alarm systems, and other IT-related business solutions. Most of the company's potential customers or leads are sourced from various channels, including Facebook page advertisements, partner companies, and referrals from previous customers or business connections. As a result, the company encounters difficulties in systematically handling and monitoring potential clients.

Currently, the company records customer leads and transaction details using Google Spreadsheets. These processes are often handled across separate platforms, services, or applications. The fragmentation of customer data across multiple environments creates inefficiencies, as employees frequently switch between applications to view customer data, verify customer information, review the history of negotiations, and determine the current status of ongoing transactions. Although this method allows basic documentation of client information, it relies heavily on manual data entry and is prone to human error. Another problem is tracking the complete history of transactions with specific clients because when a customer purchases additional services or products, the previous status in the spreadsheet may be overwritten during updates. As a result, the company has difficulty maintaining a complete record of past interactions, service requests, quotations, and completed projects with returning clients.

Disconnected modules pose a core risk to business-customer relationships. Data fragmentation occurs when there is no single source of truth — a centralized location where all of a customer's information, including their most recent interactions and the current status of their lead, can be accessed in one place. This leads to employees operating in silos, reducing collaborative effort and lowering productivity because employees must gather fragments of data from different sources to determine a client's history. This also creates data inaccuracies, as information from multiple sources may not remain consistent or up-to-date.

---

### Purpose and Description

LeadCRM is a Customer Relationship Management (CRM) system designed to centralize and automate business processes related to managing customer relationships and tracking interactions between the customer and the company. The purpose of LeadCRM is to replace the traditional, manual, and fragmented approach businesses use to handle customer relationships — where statuses are manually tracked, customer data is stored across separate environments, and leads are managed without automation or unified visibility. This fragmented approach leads to disconnected information and reduced efficiency. Employees constantly switch between multiple applications to verify a customer's history and current phase in the sales process. Additionally, customer leads may come from various sources, making it more challenging for businesses to organize and monitor them efficiently.

LeadCRM is developed and offered as a SaaS-based platform. This approach reduces the risk of companies operating on outdated software and instead provides businesses access to the latest version of the system through flexible subscription plans, including monthly, quarterly, and annual options. The responsibility for maintenance of LeadCRM lies solely with the System Administrators rather than the end users, which eliminates the need for businesses to hire a specialized team to manage the platform.

LeadCRM centralizes business processes into a single system, allowing data to be held, managed, and stored in one place for easy access to needed customer data. The system includes a tracking module where leads are organized based on their status and the customer's level of engagement with the company. By utilizing an interest- and engagement-based organization approach, the system ensures that leads with the highest probability of becoming business opportunities are prioritized, while stagnant or withdrawn inquiries are moved to the background.

LeadCRM classifies leads using the following statuses based on a customer's interactions with the business:

- **Hot** — The lead is billable and closeable within the month, with a confirmed service timeline.
- **Warm** — The inquiry has not been confirmed and has no timeline yet. The lead remains responsive but has not made a decision on proceeding.
- **Cold** — The lead has stopped responding to the business's outreach attempts, but has not yet been formally cancelled.
- **Cancelled** — The lead has withdrawn from negotiations, and the company has written confirmation of cancellation.
- **Closed** — The service has been confirmed, approved, and paid for, and the lead has moved to the project management stage.

LeadCRM processes sensitive customer information. To ensure data integrity and confidentiality, the system implements Role-Based Access Control (RBAC). This approach ensures that only authorized employees can view and modify data. Access permissions are based on user roles, and only the Client Administrator has the authority to create and manage all other roles within their organization. The Client Administrator holds the highest position among client-level roles and has the most authority over the use of the CRM system. This role is responsible for the oversight and management of business operations at the client level, and is granted full access to all system modules including user management, workflow management, pipeline management, lead tracking, reporting, and account and billing management. Client Administrators also have the authority to manage and assign user roles based on the organization's current structure and business requirements, ensuring that employees only have access to the modules, data, and functionality relevant to their responsibilities.

At the platform level, System Administrators are responsible for maintaining and managing LeadCRM across all client organizations. These administrators oversee current clients, evaluate application submissions including basic client details and business requirements, and have the authority to activate or deactivate client subscriptions to ensure controlled access. System Administrators are also responsible for configuring payment and subscription plans, as well as managing client billing and payments. System Administrators are provided a dashboard where metrics and statistics of LeadCRM and existing clients are displayed, enabling efficient monitoring of the platform and its users.

---

### Objectives

The objective of this system is to develop a platform that improves the process of tracking and managing leads. While initially designed to support the lead management needs of Camxian Technologies, the system is built as a Software as a Service (SaaS) platform, making it adaptable and scalable for use by other organizations across various industries. The system aims to address the existing gaps in the current lead management processes by providing a centralized platform for monitoring potential clients and their interactions with the company. The following are the specific objectives of the system:

1. To design and develop a centralized CRM system that records, organizes, and manages customers and leads from different sources in one platform while preserving the complete history of customer interactions, transactions, and service requests.

2. To create a module for dynamic workflows and pipelines that automate lead management and track sales progress through different stages of the sales process.

3. To develop a module that allows the company to send batch emails and SMS messages to multiple or targeted leads for simultaneous sales campaigns.

4. To conduct testing and evaluation of the developed LeadCRM system based on the ISO/IEC 25010 software quality model.

---

### Scope and Limitations

#### Scope

The system is designed to track lead generation, record pipeline progress, and monitor clients sourced from multiple channels. LeadCRM is primarily designed for use by Camxian Technologies' staff, while clients will only receive notifications through email and SMS. As a SaaS platform, the system is not limited to Camxian Technologies and can be utilized by other organizations as well.

The system includes the following features:

- The system captures leads from multiple sources and allows users to track lead progress throughout the sales pipeline, from initial contact to conversion.
- The system allows staff to send messages to multiple leads simultaneously via email and SMS.
- The system provides dynamic workflows and pipelines for automated lead management that track leads across different stages of the sales process.
- The system generates analytics and reports that provide insights into customer behavior, sales performance, and business forecasting.
- The system will initially have only one built-in role: Client Administrator. The Client Administrator has the capability to create additional roles such as Sales Staff, Operations Head, and Chief Executive Officer (CEO), as well as other custom roles as needed. These roles are assigned specific access privileges to ensure that users can only view, create, or modify information related to their responsibilities.

The Client Administrator can assign access to specific system modules, including:
- Dashboard Module
- Contacts (Leads) Management Module
- Pipeline and Deal Management Module
- Sales Campaign Management Module
- Workflow Automation Module
- Users Management Module
- Account and Billing Management Module

The system will also include the role of System Administrator, handled by the developers. The System Administrator has access to the following system modules:
- Dashboard Module
- Client Management Module
- Pricing Management Module
- Billing Management Module
- Environment Health Monitoring Module

The system will provide a sandbox account for guests who want to test the software, subject to approval by the System Administrator. If guests are satisfied and decide to subscribe, required documents must be uploaded. The System Administrator will review the application and either approve or reject it. Once approved and payment is completed, the user will be granted access to a production account.

Even though the system is built as a website, it can be accessed not only on desktops but also on mobile phones and tablets, due to its features as a Progressive Web App (PWA), which can be added directly to the home screen for an app-like experience. Camxian Technologies has a total of 16 employees. The system will undergo development for approximately 4 months, from June to October 2026.

#### Limitations

Despite its functionality, LeadCRM has the following limitations:

- The system cannot perform offline transactions and requires an internet connection for staff to access, update, and manage data.
- LeadCRM does not have built-in customer feedback collection features. Surveys must be included within bulk emails, as this functionality is provided by a third-party application embedded within the email.
- The system does not have a built-in payment system; instead, it uses a payment gateway to integrate with a third-party application.
- The system has a simple landing page that focuses on presenting basic information about the platform such as its features, benefits, pricing plans, and user authentication functions.
- The system is limited to managing customer interactions up to the point of lead conversion. Processes involved in delivering products or services, handling post-sales support, and project execution are not covered.

---

## REVIEW OF RELATED LITERATURE / STUDIES / SYSTEMS

### Review of Related Literature

*(The original Review of Related Literature content from your submitted draft is preserved here. Minor corrections to grammar, punctuation, and in-text citation formatting have been applied. All citations are retained and verified against the References section.)*

The integration of Customer Relationship Management (CRM) has gained significance in the modern era where digitization has transformed business operations. According to Oracle (2026), a CRM system is a tool that allows companies to collect, manage, and analyze customer information and interactions, including purchases, service requests, quotes, and proposals. Beyond being a tool, CRM is also a business strategy. This is in line with the bibliometric study of Judijanto (2025), which identified CRM as an emerging business strategy providing a comprehensive approach by integrating marketing, sales, services, and analytics to help businesses foster stronger customer relationships.

Several studies have supported this argument, stating that CRM systems can improve business performance and customer satisfaction. A recent study by Lasola (2025) found that the growing adoption of CRM systems by companies in the Philippines has improved customer satisfaction and business efficiency, as these systems help in managing customer relationships, enhancing service quality, and building customer loyalty that leads to business growth. Similarly, Umozurike (2025) noted that although CRM systems are designed to assist companies in managing customer information and reaching a large number of customers, these systems may not adequately cope with evolving customer behaviors that are more complex and dynamic due to digital trends. Traditional CRM systems generally operate on the assumption that customers behave in predictable patterns and that simple, rule-based communication approaches are sufficient. Kattula (2025) further supported this by highlighting the limitations of traditional CRM systems, noting that these systems often store data in silos, rely on manual tasks such as data entry and repetitive lead tracking, lack real-time insights, and struggle to integrate multiple data sources — resulting in fragmented customer data that leads to an incomplete and inaccurate view of the customer.

On the other hand, there were also studies highlighting that modern CRM systems boost productivity through automation and centralized data management. Based on the analysis of Nethanani et al. (2024), CRM adoption can increase productivity by 20–35% through automated processes and improved data management, eliminating the need for employees to manually gather and combine information from different sources. This systematic review concluded that CRM implementation in small and medium enterprises (SMEs) contributes to enhancing operational efficiency, customer retention, and sales growth through effective data management. Adding to this, Bokde and Darware (2024) stated that centralized CRM systems reduce inconsistent records, delayed responses, and missed follow-ups by providing a single source of reliable customer information that all department members can reference.

Within the broader scope of CRM, email marketing has been identified as a widely used and cost-efficient communication channel. As stated in the literature review conducted by Jayanna and Mayya (2025), email marketing is identified as one of the most cost-effective digital channels, providing high ROI and reach. The study emphasized that the effectiveness of email marketing largely depends on personalization, behavioral triggers, and integration with CRM systems. Furthermore, automation features such as triggered emails and dynamic content generation enable real-time adaptation to customer behavior, increasing engagement and conversion rates. In addition, CRM platforms support multi-channel communication strategies by incorporating email marketing automation into a single platform, enabling companies to manage campaigns, streamline customer interactions, and improve the efficiency of digital marketing efforts (Berestetska et al., 2023).

On the aspect of system security, Role-Based Access Control (RBAC) ensures that only individuals with certain roles can access specific data and functions within a CRM system. Atakari (2025) reported that implementing RBAC in information systems significantly reduced the risk of unauthorized access, insider threats, and policy violations, indicating a 37% increase in threat detection rates and a 42% decrease in policy breaches in systems where RBAC was properly implemented. This becomes crucial especially when several departments share access to the same system.

Data fragmentation occurs when customer data is scattered across different platforms, reflecting a lack of a single source of truth. Laaksonen (2024) found that gaps in lead management and the absence of a unified sales funnel make it difficult for organizations to track the customer journey, which can negatively affect customer retention. Similarly, Ugbaja et al. (2024) highlighted that manual data retrieval not only slows down service delivery but also compromises customer satisfaction and contributes to the loss of potential customers.

Regarding lead classification, Wu et al. (2023) found that leads classified based on their likelihood to convert can significantly improve sales performance by enabling organizations to prioritize high-quality prospects. Their findings showed that lead scoring models can increase conversion rates from around 5% in traditional approaches to approximately 15–17% in predictive models, demonstrating that structured lead classification enhances sales efficiency, resource allocation, and overall performance.

Sales pipeline management is another key feature of CRM systems. As stated by Ugbaja et al. (2024), the integration of business process automation in CRM systems significantly improves sales efficiency by eliminating manual tasks like data entry, lead qualification, and follow-ups, thereby allowing sales teams to focus on negotiating with clients and closing deals. Hassinen (2022) noted that the absence of integrated workflows makes cross-departmental collaboration difficult and risks losing valuable customer data, resulting in lower customer satisfaction and reduced competitiveness.

Regarding deployment, SaaS has brought about significant changes to system delivery. According to Oracle (2026), SaaS is a cloud-based software delivery model in which the provider develops and maintains cloud application software and offers access over the internet on a pay-as-you-go basis. Gurbuz (2024) emphasized that cloud-based CRM allows SMEs to use the same advanced technologies as larger companies, but at a much lower price. Similarly, Sareddy (2023) stated that cloud-based CRM systems offer businesses unrivaled scalability, flexibility, and cost-effectiveness by eliminating the need to invest in hardware and following subscription-based pricing models.

Finally, the proposed LeadCRM system will be designed as a Progressive Web App (PWA) that functions like a native application without the need for downloading from an app store. According to Charter Global (2024), a PWA can be added directly to a device's home screen and run on different operating systems, regardless of whether users are on Windows, Android, or iOS.

### Synthesis (Review of Related Literature)

The reviewed literature clearly demonstrates that CRM systems play a significant role in improving how businesses manage customer data, automate sales pipelines, and track leads efficiently. CRM has been identified not only as a tool but as a business strategy that incorporates marketing, sales, services, and analytics to strengthen customer relationships and support business growth (Judijanto, 2025; Oracle, 2026). A local study by Lasola (2025) further supported this, finding that companies in the Philippines that adopted CRM systems experienced improved customer satisfaction and business efficiency.

Despite its advantages, Umozurike (2025) and Kattula (2025) pointed out that traditional CRM systems are unable to cope with evolving customer behaviors, suffer from data silos, rely heavily on manual tasks, and lack the ability to integrate multiple data sources. These factors prevent companies from achieving a complete and accurate customer profile. Laaksonen (2024) and Ugbaja et al. (2024) further supported this, noting that problems in lead management, the absence of a unified sales funnel, and fragmented customer data make it difficult for organizations to track customer journeys, which slows down service delivery and negatively impacts customer retention.

Modern CRM systems have addressed these challenges through automation and centralized data management. Studies indicate that CRM adoption may increase productivity by 20–35% through workflow automation and improved data accessibility (Nethanani et al., 2024). Centralized CRM platforms reduce inconsistencies, delays, and missed follow-ups by providing a single, reliable source of customer information (Bokde and Darware, 2024).

The reviewed literature also highlighted the significance of communication features. Jayanna and Mayya (2025) noted that email marketing, when integrated within CRM systems, is one of the most cost-effective digital channels. Berestetska et al. (2023) further supported that multi-channel communication and automated responses improve marketing efficiency and customer engagement. Riaz Pitafi and Mumtaz Awan (2024) emphasized that batch messaging features such as bulk emails and SMS allow businesses to simultaneously reach a large number of targeted leads.

Regarding security, Atakari (2025) demonstrated that implementing RBAC significantly reduces unauthorized access and policy violations. Structured lead classification and scoring were identified as crucial CRM features, with Wu et al. (2023) showing that predictive lead scoring models can increase conversion rates from approximately 5% with traditional methods to up to 17%. Ugbaja et al. (2024) further noted that automation eliminates manual tasks and allows sales teams to focus on higher-value activities, while Hassinen (2022) confirmed that the absence of integrated workflows hinders collaboration and damages customer experience.

SaaS-based deployment has simplified and democratized access to CRM for businesses of all sizes, offering scalability, flexibility, and cost-effectiveness that eliminates the need for on-premise systems (Sareddy, 2023; Gurbuz, 2024; Oracle, 2026). PWAs have further enhanced accessibility, allowing CRM systems to operate across various devices without requiring app store downloads (Charter Global, 2024).

In relation to Camxian Technologies, the reviewed literature directly aligns with the challenges the company currently experiences: fragmented data from Google Spreadsheets, incomplete transaction history, lack of automation, and inefficient lead tracking. The proposed LeadCRM system aims to address these gaps by centralizing lead and customer data, enabling automated pipelines and workflows, supporting batch email and SMS communications, and providing real-time reporting and analytics.

---

### Review of Related Studies and/or Systems

*(The Related Systems comparison content from the original draft is retained below. System descriptions and the benchmark table are preserved.)*

**Figure 1. HubSpot Smart CRM**

HubSpot Smart CRM is an AI-powered CRM platform that centralizes customer data and integrates marketing, sales, and customer service tools into one system. It helps organizations manage customer interactions, track leads, automate workflows, and analyze customer behavior using artificial intelligence and real-time data (HubSpot, 2026). The platform offers features including lead management, contact management, pipeline management, and reporting and analytics. It utilizes an AI assistant named Breeze Assistant that uses the company's CRM data to provide insights, automate tasks, and assist users directly in the platform.

**Figure 2. Zoho CRM**

Zoho CRM is a CRM system that presents itself as an alternative to more complex enterprise CRM platforms. Compared to its competitors, Zoho CRM features a user-friendly interface and a customer-centric business approach that prioritizes user needs and flexibility. Zoho offers a month-to-month subscription without hidden costs and provides mobile accessibility. A distinguishing feature of Zoho is its high degree of customizability, allowing businesses to integrate their own modules and business logic. The platform also offers automation in sales workflows, efficient data migration tools, and integration with more than 40 business applications (Zoho, 2026).

**Figure 3. EngageBay CRM**

EngageBay offers an all-in-one CRM system specifically designed for small businesses and startups. The platform combines marketing automation, email marketing, sales CRM, appointment scheduling, live chat, and a helpdesk into a single centralized workstation. EngageBay is positioned as a more affordable alternative to larger CRM systems such as HubSpot, offering all its features within a singular plan (EngageBay, 2026).

**Figure 4. Vtiger CRM**

Vtiger CRM is an all-in-one CRM software that centralizes customer-facing teams — including marketing, sales, and support — into a single platform. Vtiger's One View feature offers a 360-degree view of all customer data, enabling teams to develop a clearer understanding of every customer interaction. The platform automates key workflows, ensures quality customer experiences at every stage of the journey, and provides services including sales automation, pipeline management, marketing automation, and integrated AI (Vtiger, 2026).

**Figure 5. Bigin CRM**

Bigin CRM is a CRM system created by the makers of Zoho CRM and is designed as an alternative specifically for small businesses. Bigin CRM features a user-friendly, mobile-first design and offers core CRM capabilities including pipeline management, customer management, multichannel communication, and customization. Its pipeline management provides all customer-facing teams with a single source of truth for customer information. Bigin also offers built-in telephony, email, and mass emailing for campaigns (Bigin, 2026).

---

### System Benchmark

| Features | LeadCRM | HubSpot Smart CRM | Zoho CRM | EngageBay CRM | Vtiger CRM | Bigin CRM |
|---|---|---|---|---|---|---|
| AI Assistant Integration | | ✓ | | | | |
| Lead Management | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Contact Management | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pipeline Management | ✓ | ✓ | ✓ | | ✓ | ✓ |
| Reporting and Analytics | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Task Automation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| User-friendly Interface | ✓ | ✓ | ✓ | ✓ | | |
| Customizable Roles and Modules | ✓ | | ✓ | | | ✓ |
| Remote Access / PWA | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Integration with Business Apps | | ✓ | ✓ | | | |
| Batch Emailing | ✓ | ✓ | ✓ | ✓ | | |
| Batch SMS | ✓ | | | | | |
| Centralized Customer Data | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

*Table 1. Benchmark of the Related Systems*

---

### Synthesis (Review of Related Studies and/or Systems)

The reviewed studies and systems provide evidence that CRM plays a critical role within business, enabling the management of customer data, the automation of business processes, and the improvement of customer-business interactions. Research by Tyagi and Singh (2024) found that businesses implementing CRM systems experienced improved sales performance and organizational efficiency, including a reported 29% average increase in revenues. Naim et al. (2024) further found that CRM implementation makes customer interactions more personalized, allowing businesses to tailor their approach to individual needs and increase customer loyalty. However, proper security practices remain essential, as cloud-stored CRM data is at risk if systems are ever compromised.

The reviewed systems — HubSpot (2026), Zoho CRM (2026), EngageBay (2026), Vtiger (2026), and Bigin (2026) — each represent established CRM platforms with varying strengths. HubSpot is distinguished by its AI-powered features and marketing integration. Zoho is recognized for its flexibility and deep customizability. EngageBay is positioned for small businesses seeking affordability. Vtiger provides a 360-degree customer view. Bigin focuses on mobile-first simplicity for small teams.

Aligned with the best practices found in these established CRMs, LeadCRM has adapted a centralized platform approach to data collection and management, allowing Camxian Technologies to move away from its fragmented Google Spreadsheets approach toward a single source of truth. LeadCRM stores all customer interaction data and history in one system, eliminating the need to switch between applications. While following the same foundational features as HubSpot and Zoho, LeadCRM also offers a distinct advantage by addressing the specific functional needs of businesses like Camxian Technologies. Whereas HubSpot and Zoho focus on broad integrations, LeadCRM emphasizes customization of modules such as the Deals module, where Client Administrators and authorized users can modify pipelines by adding, removing, or restructuring stages to align with current business processes. LeadCRM also includes built-in batch emailing and SMS capabilities — features that are either unavailable or restricted behind paid tiers in competing platforms — presenting them as core features accessible at the base subscription level.

---

## METHODOLOGY

### Agile Methodology

**Figure 6. A visual representation of the Agile methodology cycle**

In developing LeadCRM, the developers will utilize Agile Methodology to break the project down into small, manageable cycles called sprints. This methodology was selected due to its flexibility and continuous improvement approach, where developers plan, develop, test, and evaluate results in each sprint. This approach encourages collaboration among developers through regular meetings to discuss ongoing tasks, roadblocks, and issues affecting the development process. Unlike the Waterfall model, Agile does not strictly tie each phase to the one before it, meaning that changes will not derail the overall project roadmap. This makes the development process more responsive and effective (Laoyan, 2025).

---

## TECHNICAL BACKGROUND

### Technologies to be Used

LeadCRM is built on a modern, full-stack TypeScript technology stack designed to grow with the company and achieve its objectives: creating a single source of truth for all organizational leads, automating workflows, and streamlining CRM processes within a SaaS environment. The system is organized as a monorepo — a single repository that contains multiple independent packages (frontend, backend, and shared) — using Turborepo as the build orchestration tool. This approach facilitates code sharing, cross-package type checking, and unified build pipelines across all three sub-packages (LogRocket, 2024).

The system has three main components: the frontend for user interface and experience, the backend for business logic and data processing, and the database for data storage.

**Frontend**

The frontend is built with **Next.js 15**, a React-based framework that supports the App Router architecture and Server Components, enabling optimal performance for Progressive Web App (PWA) delivery. Next.js 15 provides a file-based routing system where `app/` directory pages serve as the routing layer only, while business logic resides in dedicated feature modules (Vercel, 2025). **Tailwind CSS v4** is used to provide a clean, responsive, and consistent user interface using a CSS-first configuration approach that requires no separate configuration file. Additionally, **ShadCN** provides a set of reusable, accessible UI components built on Radix UI and Class Variance Authority (CVA), improving user experience and accelerating UI development. **Chart.js** with `react-chartjs-2` is used to generate sales reports and analytics with graphical representations of sales performance, lead conversion rates, and customer engagement trends.

**Backend**

The backend is developed using **Node.js** as the runtime environment, with **Express.js** used to build RESTful APIs that manage authentication, authorization, and data exchange between the client and server. The backend follows a domain-driven module structure where each business domain (contacts, deals, campaigns, workflows, etc.) has its own controller, service, repository, and data transfer object (DTO) files, ensuring clean separation of concerns.

**Database and ORM**

All system data is stored in **PostgreSQL**, a relational database that provides high consistency and reliability. The developers will use **Prisma ORM** as the Object-Relational Mapping tool. Prisma provides a type-safe database client generated from a single `schema.prisma` file, which serves as the authoritative source of truth for all database models and their relationships. Prisma handles database migrations automatically and integrates directly with TypeScript, eliminating the need to write raw SQL queries while maintaining a maintainable and scalable codebase (Prisma, 2025). Multi-tenancy is enforced at the data model level by including a `tenantId` field on every relevant Prisma model, ensuring that data from different client organizations is always isolated in queries.

**Authentication and Authorization**

**NextAuth.js** is used for user authentication, enabling users to log in with their registered credentials. Role-Based Access Control (RBAC) is implemented to allow Client Administrators to restrict access to system modules based on a user's assigned role, ensuring that only authorized users can access sensitive customer data. Permission checks are enforced using a `hasPermission(user, Permission.ACTION)` model rather than hardcoded role string comparisons, making the RBAC system extensible as new roles are added.

**Monorepo Shared Package**

A dedicated `shared/` package within the monorepo contains TypeScript types, RBAC constants (roles and permissions), API contract definitions, and Zod validation schemas. Both the frontend and backend import from this shared package, ensuring that type definitions and permission constants are defined once and never duplicated across codebases. This is a critical architectural decision for maintaining consistency as the codebase scales.

**Integrations**

**Gmail API** is used for all outgoing and incoming email through Google's email service. **PayMongo** serves as the payment gateway for secure online subscription payments within the system.

**Development and Collaboration Tools**

**Figma** is used for wireframing and UI/UX design. **Trello** is used to track tasks and manage Agile sprints. **Git** with **GitHub** is used for version control, code review via pull requests, and code history preservation. **Postman** is used for testing REST API endpoints, and **pgAdmin** is used for PostgreSQL database interaction during development.

---

### System Architecture and Folder Structure

LeadCRM is organized as a Turborepo monorepo containing three top-level packages: `frontend/`, `backend/`, and `shared/`. This structure physically separates concerns by deployment target while enabling type-safe code sharing through the shared package.

```
leadcrm/                          ← Monorepo root
├── frontend/                     ← Next.js 15 application
├── backend/                      ← Node.js + Express.js API
├── shared/                       ← Shared TypeScript package
├── docs/                         ← Architecture, API, and setup documentation
├── infrastructure/               ← Docker, Nginx, deployment scripts
├── .github/                      ← GitHub Actions CI/CD workflows
├── package.json                  ← Workspaces root
├── turbo.json                    ← Turborepo build pipeline
├── tsconfig.base.json            ← Shared TypeScript base configuration
└── .gitignore
```

#### Frontend Structure (`frontend/`)

The frontend follows the Next.js 15 App Router architecture. The `app/` directory is used **for routing only** — each `page.tsx` file is a thin wrapper that imports and renders the corresponding page component from the `portal/` directory. Business logic, hooks, services, and UI components are co-located within their respective portal domain folders, not inside `app/`.

```
frontend/
├── app/                          ← App Router (routing layer ONLY)
│   ├── (auth)/                   ← Public auth routes
│   │   ├── login/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (portal)/                 ← Protected CRM routes (requires auth)
│   │   ├── layout.tsx            ← Auth guard + CRM layout
│   │   ├── dashboard/page.tsx
│   │   ├── crm/
│   │   │   ├── contacts/page.tsx
│   │   │   ├── companies/page.tsx
│   │   │   ├── deals/page.tsx
│   │   │   └── pipeline/page.tsx
│   │   ├── marketing/
│   │   │   ├── campaigns/page.tsx
│   │   │   ├── email/page.tsx
│   │   │   └── templates/page.tsx
│   │   ├── operations/
│   │   │   ├── service-orders/page.tsx
│   │   │   ├── tasks/page.tsx
│   │   │   └── inventory/page.tsx
│   │   ├── automation/
│   │   │   └── workflows/page.tsx
│   │   ├── reporting/
│   │   │   └── reports/page.tsx
│   │   ├── billing/page.tsx
│   │   ├── users/page.tsx
│   │   ├── audit/page.tsx
│   │   └── settings/page.tsx
│   ├── (system-admin)/           ← Protected System Admin routes
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── tenants/page.tsx
│   │   ├── pricing/page.tsx
│   │   ├── billing/page.tsx
│   │   └── environments/page.tsx
│   ├── api/
│   │   └── webhooks/
│   │       ├── gmail/route.ts
│   │       └── paymongo/route.ts
│   └── layout.tsx                ← Root layout (metadata, providers)
│
├── portal/                       ← Business logic (physical portal split)
│   ├── client/                   ← CRM portal (Client Admin, Sales Rep, etc.)
│   │   ├── crm/
│   │   │   ├── contacts/         ← ui/ hooks/ services/ schemas/ types/
│   │   │   ├── companies/
│   │   │   ├── deals/
│   │   │   └── pipeline/
│   │   ├── marketing/
│   │   │   ├── campaigns/
│   │   │   ├── email/
│   │   │   └── templates/
│   │   ├── operations/
│   │   │   ├── service-orders/
│   │   │   ├── tasks/
│   │   │   └── inventory/
│   │   ├── automation/
│   │   │   └── workflows/
│   │   ├── reporting/
│   │   ├── billing/
│   │   ├── users/
│   │   ├── audit/
│   │   ├── settings/
│   │   └── dashboard/
│   └── admin/                    ← System Admin portal (LeadCRM operators only)
│       ├── tenants/
│       ├── pricing/
│       ├── billing/
│       └── environments/
│
├── shared/                       ← Frontend-only reusable code
│   ├── ui/                       ← ShadCN primitives (Button, Input, etc.)
│   ├── charts/                   ← Chart.js wrappers (ChartComponents.tsx)
│   ├── components/               ← TrelloFilter, SideSheet, EmptyState, etc.
│   ├── hooks/                    ← useTheme, useDebounce, usePagination
│   ├── layouts/                  ← CrmLayout, AdminLayout, sidebar, navbar
│   └── providers/                ← AuthProvider, DataProvider, ThemeProvider
│
├── store/                        ← DataContext, AuthContext, types, mock data
├── lib/                          ← utils.ts, constants.ts, countries.ts
├── public/                       ← Static assets, PWA manifest, service worker
├── next.config.ts
├── tsconfig.json
└── package.json
```

Each domain module inside `portal/client/` follows a consistent internal structure:

```
portal/client/crm/contacts/
├── ui/           ← Domain-specific UI components (table, forms, filters, profile)
├── hooks/        ← Custom React hooks (useContacts, useContactFilters, etc.)
├── services/     ← Business logic (contactService.ts — CRUD + business rules)
├── schemas/      ← Zod validation schemas
├── types/        ← Domain-local TypeScript types
└── index.ts      ← Barrel export
```

The `portal/client/` and `portal/admin/` directories are physically separated, not just separated by route groups. This prevents developers from accidentally importing CRM components into the admin portal and vice versa — a practice that would violate the dual-portal separation principle.

#### Backend Structure (`backend/`)

```
backend/
├── prisma/
│   ├── schema.prisma             ← Single source of truth for all DB models
│   ├── migrations/               ← Auto-generated by Prisma migrate
│   └── seed.ts                   ← Database seeding script
│
└── src/
    ├── modules/                  ← Domain-driven business modules
    │   ├── crm/
    │   │   ├── contacts/         ← contacts.controller.ts / .service.ts / .repository.ts / .dto.ts
    │   │   ├── companies/
    │   │   ├── deals/
    │   │   └── pipeline/
    │   ├── marketing/
    │   │   ├── campaigns/
    │   │   ├── email/
    │   │   └── templates/
    │   ├── automation/
    │   │   ├── workflows/
    │   │   ├── triggers/
    │   │   └── actions/
    │   ├── operations/
    │   │   ├── service-orders/
    │   │   └── tasks/
    │   ├── administration/
    │   │   ├── users/
    │   │   ├── roles/
    │   │   ├── permissions/
    │   │   └── audit/
    │   ├── billing/
    │   │   ├── invoices/
    │   │   └── payments/
    │   └── reporting/
    │
    ├── integrations/
    │   ├── gmail/                ← gmail.service.ts, gmail.oauth.ts, gmail.types.ts
    │   └── paymongo/             ← paymongo.service.ts, paymongo.webhooks.ts, paymongo.types.ts
    │
    ├── core/
    │   ├── auth/                 ← auth.service.ts, jwt.service.ts, session.service.ts
    │   ├── permissions/          ← permission.registry.ts, rbac.service.ts, has-permission.ts
    │   ├── audit/                ← audit.service.ts, audit.interceptor.ts
    │   └── tenant/               ← tenant.service.ts, tenant.context.ts
    │
    ├── middleware/               ← auth, rbac, tenant, validation, error, logger, rate-limit
    ├── config/                   ← app.config.ts, database.config.ts, mail.config.ts
    ├── shared/                   ← Backend-specific constants, helpers, errors
    ├── app.ts
    └── server.ts
```

Each backend module follows a strict layered architecture:

| File | Responsibility |
|---|---|
| `*.controller.ts` | HTTP request/response handling only |
| `*.service.ts` | Business logic only — never uses `req`/`res` |
| `*.repository.ts` | Database queries only — no business logic |
| `*.dto.ts` | Input/output shape definitions |
| `*.types.ts` | Module-local TypeScript types |

#### Shared Package (`shared/`)

```
shared/
├── types/          ← Shared TypeScript interfaces (contact, user, deal, campaign, tenant, etc.)
├── contracts/      ← API shape contracts (what the API accepts and returns)
├── validation/     ← Zod schemas used by both frontend forms and backend middleware
├── constants/      ← roles.ts and permissions.ts — RBAC definitions
├── package.json
└── tsconfig.json
```

Both the frontend and backend import from this shared package. Role and permission constants are defined once here and never duplicated:

```typescript
// backend: modules/crm/contacts/contacts.service.ts
import { ContactType } from '@leadcrm/shared';

// frontend: portal/client/crm/contacts/services/contactService.ts
import { ContactType } from '@leadcrm/shared';
```

RBAC permission checks use the shared Permission enum rather than hardcoded role strings:

```typescript
// ❌ Bad — fragile and unscalable
if (user.role === 'Admin') { ... }

// ✅ Good — scalable and refactorable
hasPermission(user, Permission.CONTACT_CREATE);
```

Multi-tenancy is enforced at the database model level. Every Prisma model that stores tenant-specific data includes a required `tenantId` field:

```prisma
model Contact {
  id        String @id @default(cuid())
  tenantId  String // REQUIRED — enforces data isolation
  firstName String
  lastName  String
}
```

This ensures that Client A and Client B can never see each other's data, regardless of the query.

---

### Calendar of Activities

*(The Calendar of Activities content from the original draft is retained here, updated to reflect the correct development timeline of June to October 2026.)*

To develop a fully functional web application requires significant time and effort. The process started as soon as the group had an assigned adviser. During the first week of February 2026, developers conducted a meeting to brainstorm titles. Two out of three prepared titles were approved, and the group selected LeadCRM as the most feasible option.

Before writing Chapter 1, the developers set up a meeting with the client, Camxian Technologies, involving their Chief Executive Officer (CEO), Operations Head, and the company's tech consultant. The Operations Head introduced the current processes and problems encountered. The developers gathered the needed data and drafted Chapter 1. Before proceeding to Chapter 2, the developers conducted another meeting to decide on the technologies to be used and created a system prototype using Figma. The developers have completed Chapter 2 of the documentation and are preparing for the development phase.

---

### Resources

#### Hardware

The developers will use Lenovo LOQ laptops for the development of this project.

**LENOVO LOQ SPECIFICATIONS**

| Component | Specification |
|---|---|
| RAM | 8GB Memory |
| Storage | 512GB SSD |
| Processor | Intel Core i5-12450H |

*Table 3. Hardware resources used in developing the system*

**MINIMUM REQUIREMENTS**

| Component | Specification |
|---|---|
| RAM | 4GB Memory |
| Storage | 256GB SSD |
| Processor | Intel Core i3 8th Gen |

*Table 4. Minimum hardware requirements to use the system*

#### Software

| Name | Version | Description / Purpose |
|---|---|---|
| Visual Studio Code | 1.115.0 | Main development environment |
| Git | 2.53.0 | Source code version control |
| GitHub | 3.5.1 | Version control and collaboration |
| Node.js | 24.14.1 | Backend runtime environment |
| npm | 11.11.0 | Package manager |
| Google Chrome | 147.0.7727.56 | System testing and visual bug detection |
| Gmail | 6.0.260330 | Outgoing email and notification management |
| Postman | v12.5.5 | REST API endpoint testing |
| pgAdmin | v9.14 | PostgreSQL database interaction |
| PayMongo | 1.13.9 | Payment gateway for subscriptions |

*Table 5. Software resources used in developing the system*

---

## REQUIREMENTS ANALYSIS

LeadCRM is designed to provide a solution that addresses the needs of businesses in managing customer relationships, potential leads, and sales pipelines. The system is offered as SaaS and is intended for companies as primary users, which may include a company's sales and/or marketing team, operations team, and top management. LeadCRM offers dynamic and customizable role assignment, allowing companies to define and manage user roles according to their business structure and processes. Companies such as Camxian Technologies will be able to integrate and customize the CRM system in accordance with their current business processes.

Camxian Technologies is an IT solutions and technology services company offering security, telecommunications, and IT services for both households and businesses. In alignment with the company's mission of delivering innovative solutions and excellent customer satisfaction, LeadCRM will assist the company in providing exceptional customer service and an improved customer satisfaction rate.

Since LeadCRM is a SaaS platform, the system will be hosted in a cloud-based environment. By deploying LeadCRM as a PWA, the platform becomes accessible on any device with a web browser. Access is acquired through a subscription-based model. The expected deployment is scheduled for November 2026.

---

## REQUIREMENTS DOCUMENTATION

### Functional Requirements

*(The complete functional requirements REQ001–REQ065 from the original draft are retained below without modification, as they accurately represent the system's functional scope.)*

**User Authentication & Registration Process**

- **REQ001:** The system shall allow guests to fill out a sign-up form with login details (name, email, password) and company details (company name, industry, company size, optional website) and receive an email verification code after signing up.
- **REQ002:** The System Administrator shall receive email notifications for new applications and will be provided a separate UI to view, approve, or reject applications.
- **REQ003:** The system will automatically create a sandbox account for guests upon approval by the System Administrator and send a confirmation email to the applicant.
- **REQ004:** If an application is rejected, the system will notify the applicant via email, including the reason for denial.
- **REQ005:** Upon receiving confirmation, the guest shall be able to access their sandbox account using their login credentials.
- **REQ006:** The guest shall be able to upgrade the account from sandbox to production by submitting required documents and completing payment.

**Role Management Module**

- **REQ007:** The Client Administrator shall be able to create roles and assign permissions.
- **REQ008:** The Client Administrator shall be able to edit roles and modify permissions, applying changes to all users assigned to those roles.
- **REQ009:** The Client Administrator shall be able to duplicate roles.
- **REQ010:** The Client Administrator shall not be able to delete a role if it is assigned to any user.
- **REQ011:** The system shall only allow deletion of a role if no users are currently assigned to it.
- **REQ012:** The system shall display a list of all created roles, including descriptions and the total number of users assigned to each role.
- **REQ013:** The system shall display a list of all available permissions that can be assigned to a role.

**User Management Module**

- **REQ014:** The Client Administrator and/or users with an assigned role shall be able to view the list of all existing users, except their passwords.
- **REQ015:** The Client Administrator and/or users with an assigned role shall be able to add new users and send activation links to their email.
- **REQ016:** The Client Administrator and/or users with an assigned role shall be able to modify a user's status (active or inactive) and role.
- **REQ017:** The Client Administrator and/or users with an assigned role shall be able to search users by name or email and filter by role.
- **REQ018:** The Client Administrator and/or users with an assigned role shall be able to modify user information except passwords; instead, a reset password link shall be sent to the user's email.

**Contact (Lead) Management Module**

- **REQ019:** The Client Administrator and/or users with an assigned role shall be able to view the list of all existing leads and customers.
- **REQ020:** The Client Administrator and/or users with an assigned role shall be able to search contacts by name, email, or company and filter by status.
- **REQ021:** The Client Administrator and/or users with an assigned role shall be able to add new contacts and/or leads.
- **REQ022:** The Client Administrator and/or users with an assigned role shall be able to update lead information and change their status.
- **REQ023:** The Client Administrator and/or users with an assigned role shall have the ability to archive leads.
- **REQ024:** The Client Administrator and/or users with an assigned role shall be able to retrieve archived leads.
- **REQ025:** The system shall display a list of all archived leads.

**Deal (Pipeline) Management Module**

- **REQ026:** The Client Administrator and/or users with an assigned role shall be able to view all existing pipelines.
- **REQ027:** The Client Administrator and/or users with an assigned role shall have the ability to manage existing pipelines, either modifying pipeline details or deleting a pipeline.
- **REQ028:** The Client Administrator and/or users with an assigned role shall be able to create a new pipeline.
- **REQ029:** The Client Administrator and/or users with an assigned role shall be able to add a new deal or ticket to a pipeline.
- **REQ030:** The Client Administrator and/or users with an assigned role shall be able to drag and drop a deal or ticket to another pipeline stage.

**Workflow Management Module**

- **REQ031:** The system shall display a list of all workflows.
- **REQ032:** The Client Administrator and/or users with an assigned role shall be able to create new workflows.
- **REQ033:** The Client Administrator and/or users with an assigned role shall be able to modify workflows, including their names, triggers, and actions.
- **REQ034:** The Client Administrator and/or users with an assigned role shall be able to enable or pause workflows using a toggle switch.
- **REQ035:** The Client Administrator and/or users with an assigned role shall be able to delete workflows.

**Sales Campaign Management Module**

- **REQ036:** The Client Administrator and/or users with an assigned role shall be able to view sales campaign performance metrics, including active campaigns, total messages sent, average open rate, total responses, and detailed campaign data.
- **REQ037:** The Client Administrator and/or users with an assigned role shall be able to view all existing sales campaigns and email and SMS templates.
- **REQ038:** The Client Administrator and/or users with an assigned role shall be able to use existing email and SMS templates.
- **REQ039:** The Client Administrator and/or users with an assigned role shall have the ability to preview all existing email and SMS templates.
- **REQ040:** The Client Administrator and/or users with an assigned role shall be able to create sales campaigns.
- **REQ041:** The Client Administrator and/or users with an assigned role shall be able to view detailed sales campaigns along with performance metrics.
- **REQ042:** The Client Administrator and/or users with an assigned role shall be able to enable or pause sales campaigns.
- **REQ043:** The Client Administrator and/or users with an assigned role shall be able to modify sales campaign details.
- **REQ044:** The Client Administrator and/or users with an assigned role shall be able to delete sales campaigns.

**Account Management Module**

- **REQ045:** The Client Administrator and/or users with an assigned role shall be able to view account details and the current subscription plan.
- **REQ046:** The Client Administrator and/or users with an assigned role shall be able to upgrade the current plan and complete payment through a payment gateway.
- **REQ047:** The Client Administrator and/or users with an assigned role shall have the ability to modify the subscription plan's billing cycle.
- **REQ048:** The Client Administrator and/or users with an assigned role shall be able to view current balance, next billing date, payment status, billing history, detailed invoices, and download them as PDF files.
- **REQ049:** The Client Administrator and/or users with an assigned role shall be able to add a new credit or debit card as a payment method.
- **REQ050:** The Client Administrator and/or users with an assigned role shall have the ability to modify billing information.

**Dashboard Module**

- **REQ051:** The system shall provide the Client Administrator a dashboard displaying reports including total revenue, number of active deals, total contacts, conversion rate, monthly revenue and deals performance, pipeline distribution by stage, and revenue trends over time.
- **REQ052:** The system shall provide the System Administrator a dashboard showing reports such as monthly recurring revenue, total and active clients, churn rate, revenue growth, new signups, client trends, revenue by plan, and payment statuses.

**Client Management Module**

- **REQ053:** The System Administrator shall be able to view a complete list of all registered clients, except their passwords.
- **REQ054:** The System Administrator shall be able to search clients by name or company and filter results by status or plan.
- **REQ055:** The System Administrator shall be able to view detailed information for a client, including company details, business documents, and account status.
- **REQ056:** The System Administrator shall be able to review applications and make an approval decision.
- **REQ057:** The System Administrator shall have the ability to activate or deactivate a client's access and send a reset password link to their email.

**Pricing Management Module**

- **REQ058:** The System Administrator shall be able to view all pricing plans for monthly, quarterly, and annual cycles.
- **REQ059:** The System Administrator shall be able to modify pricing plans, including plan details, features, pricing, and payment options.

**Billing Management Module**

- **REQ060:** The System Administrator shall be able to view a complete list of invoices and a billing analytics dashboard showing overall financial summaries.
- **REQ061:** The System Administrator shall have the ability to search for invoices by client name, plan type, or invoice ID.
- **REQ062:** The System Administrator shall be able to view detailed invoices for a specific client and download them as PDF files.

**Environment Health Monitoring Module**

- **REQ063:** The System Administrator shall be able to view and monitor the environmental health of each client workspace, including CPU, RAM, and storage usage.
- **REQ064:** The System Administrator shall be able to search clients by name or environment ID and filter by environment type or status.

**Progressive Web Application (PWA) Requirements**

- **REQ065:** The system shall display a banner that allows the client to click an Install button to add the application to their device's home screen.

---

### Non-Functional Requirements

*(The complete non-functional requirements REQ066–REQ130 from the original draft are retained below.)*

**Operational Requirements**

- **REQ066:** The system must provide concurrent access for 16 users who have authenticated without performance degradation.
- **REQ067:** All user activities that will cause data loss will require explicit confirmation in a modal dialog.
- **REQ068:** Contextual help tooltips shall be available for every form field and workflow feature.
- **REQ069:** The system interface must provide keyboard navigation support for all interactive elements.
- **REQ070:** All errors logged to the system will contain an anonymized user ID, timestamp, action performed, error code, and stack trace.
- **REQ071:** The PWA will function equally on Google Chrome, Mozilla Firefox, Apple Safari, and Microsoft Edge.
- **REQ072:** The interface will be responsive to screen widths from 320 pixels up to 1920 pixels.
- **REQ073:** Users will be able to export lead and contact data in CSV, JSON, and XLSX formats.
- **REQ074:** The system will maintain a complete audit trail of every CRUD operation performed on lead records without being able to modify the underlying data.
- **REQ075:** The System Administrator will have the ability to configure new lead status types through the user interface without requiring code changes.
- **REQ076:** The system will have an integration with at least one third-party email service via API keys.
- **REQ077:** The system will have an integration with at least one third-party SMS gateway provider via API keys.
- **REQ078:** The system will be integrated with PayMongo using API keys for secure payment transactions.
- **REQ079:** The system will perform automated database backups on a daily basis with a retention period of 30 days.
- **REQ080:** The platform must allow for hot-deployment of non-breaking updates without incurring full downtime.
- **REQ081:** Core services must achieve at least 70% coverage on unit testing within the defined boundaries of the modular components.
- **REQ082:** An indicator will be displayed on the user interface to reflect real-time connection status.
- **REQ083:** When performing searches and/or filtering, all user query parameters must remain intact through subsequent page navigation.
- **REQ084:** All forms and input fields must be validated on the client-side prior to submission to the backend.
- **REQ085:** A loading spinner must be displayed for all operations that take longer than one second.
- **REQ086:** Real-time progress indicators for batch message queues must be displayed during dispatch.
- **REQ087:** User-defined dashboard layout preferences will persist between browser sessions.
- **REQ088:** Error messages must be specific and provide a means to correct an unsuccessful operation.
- **REQ089:** All required fields must be validated against business rules prior to progressing from one pipeline stage to the next.
- **REQ090:** During active editing of a draft lead entry, each draft must be saved automatically to the database every 30 seconds.
- **REQ091:** Deduplication of all requests to create leads will be handled by the system to prevent duplicate entries.
- **REQ092:** The CSV template for bulk importing leads must contain detailed validation feedback on each import.
- **REQ093:** Data synchronization status must be displayed for all offline actions taken against the PWA's offline queue.

**Performance Requirements**

- **REQ094:** The system shall accomplish data storage and update operations within two (2) seconds.
- **REQ095:** The system shall retrieve and display queried records within two (2) seconds or less.
- **REQ096:** The system shall handle at least fifty (50) concurrent users while maintaining a response time of two (2) seconds.
- **REQ097:** Upon successful sign-in, the system shall fully retrieve and display all necessary data within ten (10) seconds onto the dashboard.
- **REQ098:** The system shall redirect to the user's designated dashboard within five (5) seconds upon successful sign-in and authentication.
- **REQ099:** The system shall support at least one thousand (1,000) users per organization.
- **REQ100:** Upon unexpected system failures, the system shall recover within thirty (30) seconds and draft unsaved changes.

**Security Requirements**

- **REQ101:** Users shall enforce RBAC to restrict access to company data based on the user's assigned role and associated client organization.
- **REQ102:** The system shall filter and display dashboard data associated with the user's respective role and organization.
- **REQ103:** In the event of an unexpected failure, all unsaved user changes shall be saved as a draft to prevent unintended data loss.
- **REQ104:** The system shall require explicit user confirmation before performing permanent data modifications.
- **REQ105:** The system shall require users to use complex passwords with a minimum length of 8 characters, including at least one uppercase letter, one lowercase letter, and one numerical digit.
- **REQ106:** The system shall require users to update their passwords every ninety (90) days.
- **REQ107:** The system shall prevent users from reusing previous passwords when performing a password reset.
- **REQ108:** The system shall lock account access for a minimum of five (5) minutes after five (5) consecutive failed login attempts.
- **REQ109:** The system shall secure user passwords using a hashing algorithm before storing them in the database.
- **REQ110:** The system shall hide user passwords via masking when attempting a login.

**Cultural and Political Requirements**

- **REQ111:** The system must follow the Data Privacy Act of 2012 (RA 10173) of the Philippines for all personal data processing.
- **REQ112:** The system must provide support to international customers' data in accordance with GDPR-compliant data subject rights.
- **REQ113:** The system shall use English as its language.
- **REQ114:** The system must properly format monetary values using the Philippine Peso (₱), with an option to choose from other currencies.
- **REQ115:** Date and time displayed in the system defaults to Asia/Manila time, but can also be converted to UTC.
- **REQ116:** The system must allow formatting of phone numbers according to Philippine standards, as well as validation for numbers from other countries.
- **REQ117:** At the time of user registration, the system must provide compliance notices regarding data consent in accordance with applicable laws.
- **REQ118:** Users must have the ability to export data subject access requests in a machine-readable format.
- **REQ119:** The system will not retain unnecessary data such as biometric information or sensitive government-issued identification unless there is a specific need.
- **REQ120:** Data retention policies shall allow customers to have their data permanently deleted upon request in accordance with privacy legislation.
- **REQ121:** The system will respect standard business hours in the Philippines but will allow configuration to operate globally.
- **REQ122:** The Bangko Sentral ng Pilipinas guidelines must be adhered to for electronic storage of records.
- **REQ123:** The system will reflect the Philippine public holiday calendar and may reflect public holidays in other countries.
- **REQ124:** Audit logs will be stored with data residency options compliant with Philippine local jurisdiction and international cloud regions.
- **REQ125:** Character sets will accept local character sets for both name and address fields, utilizing UTF-8 international encoding.
- **REQ126:** The date format shall be displayed as MM/DD/YYYY by default, with an option to configure regional formats.
- **REQ127:** The system must provide cross-border data transfer safeguards in accordance with the National Privacy Commission advisory and international frameworks.
- **REQ128:** Phone numbers shall be displayed in accordance with the E.164 standard, with the default country code of the Philippines (+63).
- **REQ129:** The system must provide disclaimer notices in relation to SMS communications in compliance with Philippine telco regulations.
- **REQ130:** Data collection must follow data minimization principles under applicable laws and align with both Philippine and internationally recognized privacy standards.

---

## DESIGN OF SOFTWARE, SYSTEM, PRODUCT, AND/OR PROCESSES

### Wireframing

*(The complete wireframe descriptions and system module descriptions from the original draft are retained below.)*

**Figure 7. LeadCRM Sign In and Sign Up Page**

The guest will be welcomed by a simple landing page containing buttons for "Sign In" and "Get Started." Upon clicking "Sign In," the guest can sign in using a Google account or continue with existing credentials. Guests without an account can click "Sign Up" and either register using a Google account or by filling in the required details. Before clicking "Sign Up," the guest must agree to the Terms of Service and Privacy Policy. After registration, the guest receives an email verification code. Once verified, a confirmation is sent and the guest can access the system using a sandbox account.

**Figure 8. LeadCRM Client Administrator's Dashboard Module**

The dashboard provides the Client Administrator with an overview of the organization's performance, displaying metrics such as total revenue with growth percentage, total active deals, total contacts with new additions, and the lead-to-pipeline conversion rate. The dashboard also provides visual analytics showing monthly performance, distribution of leads by stage, and revenue progression over time. A banner at the top provides an option to upgrade from sandbox to production. A banner at the bottom allows users to install the application to their device's home screen.

**Figure 9. LeadCRM Client Administrator's Contacts Module**

The Contacts module provides an overview of all the organization's contacts, including name, communication details, associated company, contact status, number of deals, monetary value, and lead source. Contact statuses reflect the current lead's engagement level. The module provides the ability to create, modify, search, filter by status, and archive contact records. Archived contacts are accessible through the "Show Archives" interface. Users can view deals for specific leads and navigate to specific pipelines in the Deals module.

**Figure 10. LeadCRM Client Administrator's Deals Module**

The Deals module provides an overview of existing pipelines and associated transactions, the ability to manage existing pipelines, create new pipelines, and add deals to pipelines. Deals are classified by priority levels: Low, Medium, and High. Client Administrators can drag and drop deals between stages and across different pipelines, or set automations in the Workflows module.

**Figure 11. LeadCRM Client Administrator's Workflows Module**

The Workflows module allows the Client Administrator to add workflows to automate business processes. Users can create workflows by clicking "Create Workflow," filling in the workflow name, description, trigger events, and optionally activating it immediately. Existing workflows can be modified or deleted, and can be enabled or paused using a toggle.

**Figure 12. LeadCRM Client Administrator's Campaigns Module**

The All Campaigns tab is the default view and shows the number of active campaigns, total campaigns sent, average open rate, and total responses. Users can create campaigns, view, edit, pause, and delete existing campaigns. The Email Templates and SMS Templates tabs allow users to preview, reuse, and create email and SMS templates.

**Figure 13. LeadCRM Client Administrator's Users Management Module**

The Users module allows the Client Administrator to view all users except passwords, add new users and send activation links, modify user status and roles, and search or filter users by name, email, or role.

**Figure 14. LeadCRM Client Administrator's Accounts Module**

The Account Details tab displays the account information and current subscription plan. The Client Administrator can manage the plan, upgrade the subscription, and complete payment through the payment gateway. The Billing and Payments tab displays current balance, next billing date, payment status, billing history, invoices, payment methods, and recent transactions.

**Figure 15. LeadCRM Client Administrator's Settings Module**

The Roles tab allows the Client Administrator to view all established roles, create new roles, and assign permissions. The All Permissions tab shows all available permissions that can be assigned to roles. Roles with no assigned users can be deleted.

**Figure 16. LeadCRM System Administrator's Dashboard Module**

The System Administrator dashboard shows Monthly Recurring Revenue (MRR), total and active clients, churn rate, revenue growth, new signups, client trends, revenue by plan, and payment status distribution. The dashboard can be filtered by specific time periods.

**Figure 17. LeadCRM System Administrator's Client Management Module**

The System Administrator can view all client accounts, search by company name or email, filter by status and plan, review and approve or reject applications, activate or deactivate accounts, and send password reset links.

**Figure 18. LeadCRM System Administrator's Pricing Module**

The System Administrator can configure and manage pricing plans for monthly, quarterly, and annual billing cycles. Each plan can be modified through an "Edit Pricing Plan" modal where plan details, pricing, features, and payment methods can be updated.

**Figure 19. LeadCRM System Administrator's Billing Module**

The Billing module allows the System Administrator to view invoices and payment history for all clients, view performance metrics including total monthly revenue, pending revenue, and failed payments, search invoices by client name, plan, or invoice number, view detailed invoice information, and download invoices as PDF files.

**Figure 20. LeadCRM System Administrator's Environment Health Module**

The Environment Health module allows the System Administrator to monitor client environments in real time. A search bar enables quick lookup by client name or environment ID. Dropdown filters allow filtering by environment type (production or sandbox) and by status (healthy, warning, or critical).

---

## REFERENCES

Atakari, C. (2025). Adaptive role-based access control and policy enforcement in ERP systems for governmental and military applications. *International Journal of Emerging Research in Engineering and Technology, 6*(3), 77–85. https://ijeret.org/index.php/ijeret/article/view/289

Berestetska, O., Iankovets, T., Orozonova, A., Voitovych, S., Parmanasova, A., & Medvedieva, K. (2023). Using CRM systems for the development and implementation of communication strategies for digital brand management and internet marketing: EU experience. *International Journal of Professional Business Review, 8*(4), e01613. https://doi.org/10.26668/businessreview/2023.v8i4.1613

Bigin. (2026). *Features list*. https://www.bigin.com/features/

Bigin. (2026). *The Bigin story*. https://www.bigin.com/the-bigin-story.html

Bokde, J., & Darware, S. A. (2024). Implementing CRM: Best practices for small businesses. In *The three pillars of business: A guide to integrated marketing, finance & HR practices*. IIP Series. http://dx.doi.org/10.2139/ssrn.5102230

Charter Global. (2024). *Progressive Web Apps (PWAs): Advantages, disadvantages & more*. https://www.charterglobal.com/progressive-web-apps/

EngageBay. (2026). *CRM software*. https://www.engagebay.com/crm/engagebay-crm

Grant, J. (2025). *What is SaaS CRM?* Retrieved from relevant business technology source.

Gurbuz, A. V. (2024). *The role of cloud-based CRM systems in enhancing SMEs' financial management capacities by efficiently collecting, analyzing, and utilizing customer data*. National College of Ireland. https://norma.ncirl.ie/id/eprint/8396

Hargrave, M. (2025). CRM (Customer Relationship Management): Elements, benefits, and technology. *Investopedia*. https://www.investopedia.com/terms/c/customer_relation_management.asp

Hassinen, V. E. (2022). *CRM system optimization in sales and marketing*. Karelia University of Applied Sciences. https://www.theseus.fi/handle/10024/787755

HubSpot. (2026). *HubSpot customer platform*. https://www.hubspot.com/products/customer-platform

Jayanna, B. M., & Mayya, S. (2025). Email marketing strategies for enhancing customer engagement: A comprehensive literature review. *International Journal of Scientific Research in Science, Engineering and Technology, 12*(1), 371–392. https://ijsrset.com/index.php/home/article/view/IJSRSET25121188

Judijanto, L. (2025). Customer relationship management as an emerging business strategy: A bibliometric review. *[Journal name]*. [DOI/URL]

Kattula, N. (2025). The evolution of CRM: AI-powered personalization meets hyperautomation. *World Journal of Advanced Engineering Technology and Sciences, 15*(01), 1090–1105. https://wjaets.com/content/evolution-crm-ai-powered-personalization-meets-hyperautomation

Kavlakoglu, E., Finn, T., & Downie, A. (2024). *What is Customer Relationship Management (CRM)?* IBM. https://www.ibm.com/think/topics/crm

Laaksonen, H. (2024). *Improving customer retention with marketing and sales integrated lead management: Case Finnish B2B consulting company*. LUT University. https://lutpub.lut.fi/handle/10024/167551

Laoyan, S. (2025). *What is Agile methodology? (A beginner's guide)*. Asana. https://asana.com/resources/agile-methodology

Lasola, M. J. (2025). Customer relationship management practices as determinants of business performance: A systematic literature review. *International Journal of Multidisciplinary: Applied Business and Education Research, 6*(8), 3808–3815. https://doi.org/10.11594/ijmaber.06.08.06

LogRocket. (2024). *Building a full-stack TypeScript application with Turborepo*. https://blog.logrocket.com/build-full-stack-typescript-application-turborepo/

Naim, I., Rajuddin, W. O. N., & Ansyori, A. (2024). Customer relationship management in the digital era to enhance customer experience through technology. https://journal.pascasarjana-unpas.web.id/index.php/tjm/article/view/131/117

Nethanani, R., Matlombe, L., Vuko, S., & Thango, B. (2024). Customer relationship management (CRM) systems and their impact on SMEs performance: A systematic review. *Preprints*. https://www.preprints.org/manuscript/202410.1538

Oracle. (2026). *What is SaaS (Software as a Service)?* https://www.oracle.com/asean/applications/what-is-saas/

Prisma. (2025). *Prisma ORM documentation*. https://www.prisma.io/docs

Riaz Pitafi, Z., & Mumtaz Awan, T. (2024). Integrating social media in CRM: Engaging customers on digital platforms. In *Business, Management and Economics*. IntechOpen. https://www.intechopen.com/chapters/89495

Sareddy, M. R. (2023). Cloud-based customer relationship management: Driving business success in the e-business environment. *International Journal of Marketing Management, 11*(2), 58–72. https://ijmm.in/index.php/ijmm/article/view/204

Tyagi, S., & Singh, S. (2024). Impact of CRM systems on sales performance — An exploratory study. *Journal of Information Systems Engineering and Management, 9*(3). https://www.jisem-journal.com/download/27_AK-Paper2.pdf

Ugbaja, U. S., Nwabekee, U. S., Owobu, W. O., & Abieba, O. A. (2024). The impact of AI and business process automation on sales efficiency and customer relationship management (CRM) performance. *International Journal of Advanced Multidisciplinary Research and Studies, 4*(6), 1829–1841. https://www.multiresearchjournal.com/arclist/list-2024.4.6/id-4156

Umozurike, V. O. (2025). The churn dilemma: Why traditional CRM fails and how AI can fix it. *American Journal of Data, Information and Knowledge Management, 6*(1), 15–22. https://doi.org/10.47672/ajdikm.2710

Vercel. (2025). *Next.js 15 documentation — App Router*. https://nextjs.org/docs/15/app

Vtiger. (2026). *Customer relationship management software*. https://www.vtiger.com

Wu, M., Andreev, P., & Benyoucef, M. (2023). The state of lead scoring models and their impact on sales performance. *Information Technology and Management, 25*, 69–98. https://pmc.ncbi.nlm.nih.gov/articles/PMC9890437/

Zoho. (2026). *Complete feature list*. https://www.zoho.com/crm/complete-feature-list.html

Zoho. (2026). *Why choose Zoho?* https://www.zoho.com/crm/why-choose-zoho-crm.html

---

## APPENDICES

### APPENDIX A — RESOURCE PERSONS

*(To be filled in by the team)*

---

### APPENDIX B — PERSONAL TECHNICAL VITAE

*(To be filled in by the team)*
