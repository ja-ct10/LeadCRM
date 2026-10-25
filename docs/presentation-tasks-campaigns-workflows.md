# LeadCRM presentation script: Tasks, Campaigns, and Workflows

Suggested length: 10–12 minutes. Read the quoted lines aloud; use the other text as navigation notes.

## Connected scenario

**Maria Santos from BrightMart is interested in a product demo from Camxian Technologies.**

Presentation sequence: review her inquiry in **Tasks** → prepare invitations in **Campaigns** → automate the next step in **Workflows** → return to **Tasks** to show the generated follow-up.

Prepare these sample records before presenting:

- A Lead named **Maria Santos**, using a demo email address and phone number you control.
- A Deal named **BrightMart - Product Demo**, linked to Maria as its primary Lead and assigned to an eligible sales agent. Use an existing configured Product.
- A saved audience named **Product Demo Leads**, with **Leads** as its source and conditions that select your demo records.
- For the Workflow dry test, a separate sample Deal currently in **Qualified**, with a recorded transition into that stage. The live demonstration Deal should remain in **Contacted** until activation.

Use a login with the required module permissions. Campaign sending needs configured email/SMS senders; Workflow email needs the Deal agent's connected and authorized Gmail account. You can demonstrate Campaigns with saved drafts and a prepared report.

## 1. Opening — 30 seconds

> “Good day, everyone. I will demonstrate how Tasks, Campaigns, and Workflows work together in LeadCRM. Tasks organize follow-up work, Campaigns send messages to selected audiences, and Workflows automate actions when CRM events occur.
>
> “Our example is Maria Santos from BrightMart, who is interested in a product demo. We will review her inquiry, prepare an invitation, and create an automatic follow-up when her opportunity becomes qualified.”

## 2. Tasks — 2–3 minutes

### A. Open Tasks

Navigate to **Tasks** (`/operations/taskboard`).

> “Tasks shows what needs to be done, who is responsible, and when the work is due. It keeps follow-ups connected to the relevant sales opportunity.”

| Control | Short explanation to say |
| --- | --- |
| Search tasks | “Search finds a task by its title or notes.” |
| All / Overdue / Today / This week | “These tabs focus the list on the due dates we need to review.” |
| Filters | “Filters narrow the list by Assigned Agent, Status, or Priority.” |
| Manage Columns | “This lets us choose which task information appears in the table.” |
| Refresh | “Refresh reloads the latest task information.” |
| Create Task | “This opens the form for a new follow-up.” |

### B. Create the first Task

Click **Create Task** and enter:

| Field | Sample value | Purpose |
| --- | --- | --- |
| Title | Review Maria's demo inquiry | Identifies the work to perform. |
| Status | To do | Shows the task's current progress. |
| Priority | High | Highlights work that needs attention first. |
| Due date and time | A future demo date, 10:00 AM, Philippine time | Sets the follow-up deadline. |
| Assigned Agent | Your eligible demo sales agent | Identifies who will do the work. |
| Notes | See the sample below. | Gives the agent clear instructions and context. |
| Associate task to deal | BrightMart - Product Demo | Connects the work to the sales opportunity. |

**Sample Task notes:**

```text
Review Maria Santos's product interest and confirm her email and phone number.
Prepare the product demo invitation and record any requirements she has shared.
Keep this follow-up linked to BrightMart - Product Demo.
```

> “I am linking this task to the BrightMart Deal. Related Leads, Contacts, and Accounts come from the selected Deal, so the agent can access the customer context.
>
> “The Assigned Agent is the person responsible for the task. Task Owner, shown as Created by, records who originally created it.”

Click **Create task** to save, then open the saved Task.

> “The task is now recorded. Edit lets us update the instructions, due date, or progress. After reviewing the inquiry, we use Done to mark the work complete. Reopen brings completed work back for attention.”

Other statuses are **In progress**, **Blocked**, **Completed**, and **Cancelled**. **Archive** removes a Task from active views; it can be restored from Archived Data. Selecting several rows exposes permitted bulk actions such as **Mark as done** and assignment.

**Transition:**

> “We have reviewed Maria's inquiry. Next, we will prepare the invitation through Campaigns.”

## 3. Campaigns — 3–4 minutes

### A. Open Campaigns and create an Email Campaign

Navigate to **Campaigns** (`/marketing/campaigns`) and click **Create Campaign**.

> “Campaigns sends a shared message to a selected audience. We can personalize the message and review the recorded results afterward.”

| Field or button | Sample / short explanation |
| --- | --- |
| Campaign Name | **Product Demo Invitation - Email**. An internal label for finding this Campaign. |
| Type | **Email** or **SMS** selects the sending channel. Create separate Campaigns for the two channels. |
| Target Audience | **Product Demo Leads** selects the intended recipients. |
| Create New | Opens a form for saving an audience and its selection rules. |
| Eligible Recipients | Shows who currently qualifies and why other records are excluded. |
| Subject Line | The heading recipients see in their inbox; available for Email. |
| Body | Contains the message recipients receive. |
| Insert Variable | Inserts a CRM field such as `{{firstName}}` to personalize the message. |
| Live preview | Shows sample personalized content; desktop and mobile controls help review the layout. |
| Save Draft | Saves the Campaign for later preparation. |
| Send → Send Now | Submits the Campaign to the configured sending provider. |
| Send → Schedule Send | Schedules one future send using Philippine time. |

If showing **Create New**, explain the audience form:

> “Audience Name identifies the saved group. Source chooses either Leads or Contacts. Each condition has a Field, an Operator, and a Value. Match all requires every condition; Match any accepts at least one. Create Audience saves these rules for reuse.”

### B. Sample Campaign Email

**Campaign Name:** Product Demo Invitation - Email\
**Subject Line:** `{{firstName}}, let's arrange your product demo`

```text
Hi {{firstName}},

Thank you for your interest in Camxian Technologies.

We would like to invite you to a short product demo to discuss your needs and show how our solution can support your business.

Please contact your Camxian sales agent with your preferred date and time.

Best regards,
Camxian Technologies Sales Team
```

> “The first-name variable uses each recipient's CRM record. In Maria's preview, the greeting becomes ‘Hi Maria.’ Preview helps us check personalization and wording before sending.”

Use **Insert Variable** for exact supported keys and check missing-value warnings. For a Leads audience, the standard Company Name key is `{{companyName}}`; for Contacts, it is `{{company}}`.

Click **Save Draft** for a draft-only demonstration.

### C. Sample Campaign SMS

Create a second Campaign with **Type: SMS** and the same demo audience.

**Campaign Name:** Product Demo Invitation - SMS

```text
Camxian: Hi {{firstName}}, interested in a product demo? Please check our email invitation and contact your sales agent. Please do not reply.
```

> “SMS gives the recipient a short reminder. It has no subject line. The character and segment counter helps us check the message after personalization.”

Review the complete Body, including any existing default footer. **Insert default SMS footer** restores the default contact/no-reply text when needed. Save this SMS as its own draft.

### D. Templates, sending, and reports

> “Email Templates and SMS Templates store reusable messages. Template Name identifies the template, Category organizes it, Preview shows its content, and Use Template starts a Campaign from it. Saving a template does not send a message.
>
> “Send Now submits the message immediately. Schedule Send sets one future send. Before sending starts, Reschedule changes that time and Cancel schedule returns the Campaign to Draft for editing.”

Open a prepared sent Campaign to show its report, if available.

> “The report shows recorded recipient outcomes and engagement. Submitted means the provider accepted the message; Delivered needs delivery evidence. Email can show opens and clicks. SMS can show tracked link clicks, while SMS opens are unavailable.”

**Transition:**

> “For the next part of our scenario, Maria has received the invitation and requested a demo. The agent records that response in the Deal and moves it to Qualified. We will configure the Workflow that handles that next step.”

If using drafts only, present Maria's response as a scenario rather than claiming the drafts were sent. Record the CRM change explicitly: email opens, clicks, and replies are not triggers in the current Workflow catalog.

## 4. Workflows — 3–4 minutes

### A. Create the automation

Navigate to **Workflows** (`/automation/workflows`) → **Create Workflow** → **Start from scratch**.

> “A Workflow follows three parts: a Trigger starts it, Conditions decide whether the record qualifies, and Actions perform the next steps.”

| Setting | Demo configuration | Why it is there |
| --- | --- | --- |
| Workflow name | Qualified Demo Follow-up | Identifies the automation. |
| Description | Create a demo follow-up task and email the prospect when a Deal enters Qualified. | Explains its purpose to the team. |
| Trigger | Deal Stage Changed | Starts evaluation when a Deal moves between stages. |
| Condition Field | New Stage | Checks the destination stage from the event. |
| Operator | Equals | Requires an exact match. |
| Value | Qualified | Limits actions to the qualifying stage. |
| Condition matching | Match all | Requires every configured rule to pass. |

> “This Workflow responds when a Deal enters Qualified. It will create a follow-up Task first, then send a confirmation email.”

### B. Action 1: Create Task

| Field | Sample value / purpose |
| --- | --- |
| Action | **Create Task** creates the follow-up automatically. |
| Associate task with | **Triggering deal** keeps the task connected to the opportunity that started this run. |
| Task title | **Confirm product demo schedule** identifies the next action. |
| Description | Use the instructions below. These appear as the Task's Notes. |
| Assign to | **Current Record Agent** gives the work to the Deal's current eligible agent. |
| Due in days | **1** sets a deadline one day after execution. |
| Priority | **High** highlights the follow-up. |

**Sample Workflow Task description:**

```text
Contact the prospect linked to this Deal.
Confirm the preferred demo date, time, requirements, and attendees.
Record the agreed schedule in the task notes.
Mark the task complete after the confirmation call.
```

> “The agent receives clear instructions and a deadline without manually creating the Task. Specific User selects one person. Role and Group can select an eligible member through a configured assignment pool.”

Create Task is currently available for Deal triggers. The current record agent must be active and eligible for Tasks.

### C. Action 2: Send Email

Choose **Send Email** and **Recipient: Primary lead**, with Maria as the Deal's primary Lead. Select an Email template or enter the Subject and Message directly.

**Subject:** `{{firstName}}, thank you for your demo request`

```text
Hi {{firstName}},

Thank you for confirming your interest in a product demo with Camxian Technologies.

Our sales agent will contact you to confirm your preferred schedule and requirements.

Best regards,
Camxian Technologies Sales Team
```

> “This is the confirmation message for a qualified opportunity. The Recipient field selects which linked person receives it. Workflow email uses the Deal agent's connected Gmail account.”

**Optional alternative — Send SMS:** Choose **Primary lead** as the recipient and use:

```text
Camxian: Hi {{firstName}}, we received your demo request. Our sales team will contact you to confirm the schedule. Please do not reply.
```

Use this as an alternative to the Email action when demonstrating SMS automation.

### D. Validate, save, test, and activate

| Button | Short explanation to say |
| --- | --- |
| Validate | “Validate checks the current configuration for setup issues.” |
| Save draft | “Save draft stores the Workflow before activation.” |
| Test | “Test opens a check using the saved Workflow.” |
| Sample record | “This chooses the CRM record used for the check.” |
| Recorded stage transition | “This supplies an actual stage-change event for testing event conditions.” |
| Run check | “Run check previews results without creating Tasks or sending messages.” |
| Save and activate | “This enables the Workflow for future matching events.” |
| Pause | “Pause stops processing future matching events.” |
| View runs | “View runs shows recorded executions and action results.” |

Click **Validate**, then **Save draft**. Open **Test**, choose your prepared Qualified sample Deal and its current recorded transition into Qualified, then select **Run check**. Check the condition results, resolved assignee, associated Deal, and rendered message. A current-record check without a recorded transition cannot match stage-event conditions.

Click **Save and activate** after resolving setup issues. Then move **BrightMart - Product Demo** from **Contacted** to **Qualified**. Open **View runs** and review the actual action outcomes.

> “Activation applies to future matching events. Moving our demonstration Deal into Qualified creates the event for this run. The run details let us verify what happened.”

## 5. Return to Tasks and close — 1 minute

Return to **Tasks**, refresh if needed, and search for **Confirm product demo schedule**. Open the generated Task and show its Assigned Agent, due date, Notes, and BrightMart Deal association. The Task also appears in the Deal's Tasks area.

> “This follow-up came from the Workflow. It is assigned to the Deal agent, has a deadline, and links back to the opportunity. After the agent confirms Maria's schedule, they record the result and select Done.
>
> “In this scenario, Tasks organized the work, Campaigns prepared the customer communication, and the Workflow created the next follow-up when the Deal became qualified. Together, these modules keep the outreach and sales activity connected.”

## Extra scenarios for questions

| Scenario | Short explanation |
| --- | --- |
| The prospect has not responded. | “Create a manual reminder Task linked to the Deal and choose a due date. Workflow timers are not available in the current trigger catalog.” |
| A Task passes its deadline. | “It appears in Overdue while active and unfinished. The agent can follow up, revise the due date, or complete the work.” |
| A Campaign recipient is excluded. | “Check the eligibility reason and correct the relevant CRM details before reviewing the audience again.” |
| A Workflow action fails. | “Open View runs, review the recorded error, and correct the setup. Check earlier action results before repeating work.” |

## Presenter reference

This script follows the current local application screens and contracts. Main references: [Tasks help](../frontend/src/features/tenant/help/content/deals-tasks.ts), [Campaigns help](../frontend/src/features/tenant/help/content/campaigns.ts), [Workflows help](../frontend/src/features/tenant/help/content/workflows.ts), and the [Workflow test panel](../frontend/src/features/tenant/automation/workflows/ui/workflow-test-panel.tsx).
