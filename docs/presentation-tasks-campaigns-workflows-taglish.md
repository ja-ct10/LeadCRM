# LeadCRM demo script — conversational Taglish

Mga 12–15 minutes, kasama ang pag-navigate. Ang naka-quote ang sasabihin mo; ang naka-italic ang gagawin sa screen. Pwede kang huminto sandali habang naglo-load o nagta-type.

## Bago magsimula

I-ready ang demo records para tuloy-tuloy ang presentation:

- **Lead:** Maria Santos, from BrightMart. Gumamit ng test email at phone number na hawak mo.
- **Deal:** BrightMart - Product Demo. Naka-link si Maria bilang primary Lead, may existing Product, at naka-assign sa eligible sales agent.
- **Audience:** Product Demo Leads. Leads ang source; ang conditions ay para sa demo recipients ninyo.
- **Para sa Workflow test:** Isang separate sample Deal na nasa Qualified, na may recorded transition papunta roon. Ang BrightMart Deal na gagalawin sa live demo ay dapat nasa Contacted pa.
- **Access at sending setup:** Gamitin ang account na may permissions para sa demo. Kailangan ng configured senders para sa Campaign email/SMS, at connected Gmail ng Deal agent para sa Workflow email.

Pwede mong i-Save Draft ang Campaigns at gumamit ng prepared sent Campaign para sa report. Sa ganitong setup, sabihin na sample scenario ang pagtanggap at pag-reply ni Maria.

## 1. Opening

> “Hi everyone. I-walk through ko ngayon ang Tasks, Campaigns, at Workflows sa LeadCRM.
>
> “Ang example natin, may inquiry si Maria Santos from BrightMart tungkol sa isang product demo. Una, gagawa tayo ng task para ma-review ang inquiry niya. Then, maghahanda tayo ng email at SMS invitation. Pag interested na siyang mag-proceed, gagamit tayo ng Workflow para automatic na may follow-up task ang agent.
>
> “Unahin natin ang Tasks.”

## 2. Tasks — i-review ang inquiry

*Buksan ang Tasks. Ituro ang search, tabs, at filters habang nagsasalita.*

> “Dito sa Tasks, makikita natin kung ano ang kailangang gawin, sino ang gagawa, at kailan ito due.
>
> “Sa Search, pwede nating hanapin ang task gamit ang title o notes. May All, Overdue, Today, at This week din para mas madaling makita kung alin ang dapat unahin.
>
> “Kung isang agent lang ang gusto nating tingnan, gamitin natin ang Filters. Pwede rin tayong mag-filter by Status at Priority. Sa Manage Columns, pipili tayo kung anong details ang gusto nating makita sa table. Yung Refresh, pang-reload ng latest records.”

*Click Create Task. Punan ang fields habang ipinapaliwanag.*

> “Gagawa tayo ng task para sa inquiry ni Maria. Click lang natin ang Create Task.
>
> “Sa Title, ilalagay ko ‘I-review ang demo inquiry ni Maria’ para malinaw agad ang gagawin.
>
> “Ang Status muna ay To do, kasi hindi pa natin nasisimulan. Kapag ginagawa na, pwede itong In progress. Kung may hinihintay o may humaharang sa task, pwede itong Blocked.
>
> “Sa Priority, pipiliin ko ang High para madaling mapansin na kailangan itong unahin.
>
> “Dito sa Due date and time, magse-set tayo ng deadline. Philippine time ang gamit natin. Sa Assigned Agent naman, pipiliin natin kung sino ang responsible sa follow-up.
>
> “Sa Notes, ilalagay natin ang instructions para alam ng agent kung ano ang iche-check.”

**Ilagay sa Notes:**

```text
I-review ang product interest ni Maria Santos at i-check ang email at phone number niya.
Ihanda ang product demo invitation at ilagay dito ang requirements na na-share niya.
Gamitin ang BrightMart - Product Demo na Deal bilang reference.
```

*Sa Associate task to deal, piliin ang BrightMart - Product Demo.*

> “Ili-link natin ito sa BrightMart Deal. Required ang Deal association sa bagong task para may malinaw na sales opportunity na konektado rito. Mula sa Deal, makikita rin ang related Lead, Contact, o Account.
>
> “Okay, click natin ang Create task para ma-save.”

*Buksan ang saved Task. Ituro ang Assigned Agent at Task Owner (Created by).*

> “Makikita natin dito kung kanino naka-assign ang task. Yung Task Owner, or Created by, kung sino ang gumawa nito. Kahit ma-reassign ang task, recorded pa rin kung sino ang original creator.
>
> “Kapag may babaguhin sa notes o deadline, gamitin natin ang Edit, then Save changes. Kapag tapos na ang review, click Done. Kung kailangan balikan ang completed task, may Reopen din.
>
> “May Archive din para alisin ang task sa active list. Pwede pa itong i-restore sa Archived Data.”

*Kung naipakita na ang sample review, i-mark as Done ang unang Task.*

> “Ngayong na-review na ang inquiry, punta naman tayo sa Campaigns para ihanda ang invitation.”

## 3. Campaigns — ihanda ang invitation

*Buksan ang Campaigns, then click Create Campaign.*

> “Dito tayo naghahanda ng email o SMS na ipapadala sa selected audience. Sa example natin, invitation ito para sa mga interested sa product demo, kasama si Maria.
>
> “Sa Campaign Name, ilalagay ko ‘Product Demo Invitation - Email.’ Pang-identify natin ito sa list. Yung Subject Line ang makikita ng recipient sa inbox niya.
>
> “Sa Type, Email muna ang piliin natin. Sa Target Audience, gagamitin ko ang Product Demo Leads.”

*Ituro ang Create New sa tabi ng Target Audience. Buksan kung kasama sa demo, then bumalik sa Campaign builder.*

> “Kung wala pang saved audience, pwede tayong gumawa dito sa Create New. Lalagyan natin ng Audience Name, then sa Source, pipili tayo kung Leads o Contacts ang kukunin.
>
> “Yung conditions ang pang-select ng recipients. Ang Field ay kung anong information ang iche-check, ang Operator ay kung paano ito iko-compare, at ang Value ay yung dapat nitong ma-match.
>
> “Kapag Match all, kailangan pasok sa lahat ng conditions. Kapag Match any, kahit isa ang mag-match. Then, Create Audience para magamit ulit natin ang rules.”

*Bumalik sa Campaign. Ituro ang Eligible Recipients.*

> “Dito sa Eligible Recipients, makikita natin kung sino ang pasok sa audience. Kung may excluded, may reason din para alam natin kung anong detail ang kailangang i-check.
>
> “Sa Body naman natin ilalagay ang mismong message.”

### Sample Campaign Email

- **Campaign Name:** Product Demo Invitation - Email
- **Type:** Email
- **Target Audience:** Product Demo Leads
- **Subject Line:** `{{firstName}}, schedule tayo ng product demo?`

```text
Hi {{firstName}},

Salamat sa interest ninyo sa Camxian Technologies!

Pwede tayong mag-schedule ng short product demo para mapag-usapan ang kailangan ng business ninyo at maipakita kung paano makakatulong ang product.

Ipaalam lang sa inyong Camxian sales agent kung anong araw at oras ang convenient sa inyo.

Salamat,
Camxian Technologies Sales Team
```

*Click Insert Variable at ipakita ang firstName. Buksan ang live preview.*

> “Yung firstName dito, kukunin niya ang pangalan mula sa CRM record. Kaya para kay Maria, magiging ‘Hi Maria’ ang greeting.
>
> “Gamitin natin ang Insert Variable para tama ang field na mailagay. Then, check natin sa preview kung maayos ang pangalan at message. May desktop at mobile preview din para makita ang layout.
>
> “I-Save Draft muna natin ito. Naka-save na ang preparation natin, pero wala pang ipinapadala.”

### Sample Campaign SMS

*Gumawa ng hiwalay na Campaign. Piliin ang SMS at ang parehong demo audience.*

> “Gagawa naman tayo ng SMS reminder. Hiwalay na Campaign ito, kaya ang name natin ay ‘Product Demo Invitation - SMS.’ Pareho pa rin ang audience.
>
> “Walang subject line sa SMS. Diretso tayo sa Body, at mas maikli ang message.”

**Campaign Name:** Product Demo Invitation - SMS

```text
Hi {{firstName}}! Na-email na namin ang product demo invite. Contact your Camxian sales agent para sa schedule. Please do not reply.
```

> “May character at segment counter dito para ma-check ang haba ng personalized message. Kung may default footer na sa Body, i-review din natin para hindi paulit-ulit ang contact details o no-reply reminder.
>
> “Kung kailangan ibalik ang default footer, may Insert default SMS footer. I-Save Draft din natin itong SMS.”

### Templates, send options, at reports

*Ipakita ang Email Templates at SMS Templates.*

> “Kung madalas nating gamitin ang ganitong message, pwede natin itong i-save as a template.
>
> “Ang Template Name ang panghanap natin, at ang Category ang pang-organize. Sa Preview, makikita natin ang laman. Sa Use Template, magagamit na natin ang message sa Campaign. Yung Save Template, sine-save lang ang message para magamit ulit.”

*Buksan ang Send menu sa isang draft.*

> “Kapag ready na, may Send Now para i-submit ang Campaign for sending. Kung later pa, piliin ang Schedule Send at mag-set ng date at time. One-time send ito, gamit ang Philippine time.
>
> “Kung scheduled na at hindi pa nagsisimula ang sending, pwede nating i-Reschedule. Kung babaguhin ang content, Cancel schedule muna para bumalik sa Draft.”

*Buksan ang prepared sent Campaign at ang report nito.*

> “Sa report, makikita natin ang status ng bawat recipient. Kapag Submitted, tinanggap na ng sending provider ang message. Kapag Delivered, may delivery confirmation na.
>
> “Sa Email, pwede ring makita ang opens at clicks kapag may recorded data. Sa SMS, tracked link clicks ang pwede nating makita; walang SMS open count.”

**Transition papunta sa Workflows:**

> “Ngayon, sabihin nating natanggap ni Maria ang invitation at interested siyang mag-proceed. Ire-record ng agent ang update sa Deal. Kapag nilipat niya ito sa Qualified, doon natin gustong magkaroon ng automatic na follow-up.
>
> “Ise-set up natin iyon sa Workflows.”

## 4. Workflows — automatic na follow-up

*Buksan ang Workflows → Create Workflow → Start from scratch.*

> “Dito natin ise-set kung kailan gagawa ng action ang system. May tatlong parts: Trigger, Conditions, at Actions.
>
> “Ang Trigger ang event na magsisimula ng check. Ang Conditions ang rules na kailangang ma-meet. Ang Actions naman ang gagawin kapag pasok sa rules.
>
> “Pangalanan natin itong ‘Qualified Demo Follow-up.’ Sa Description, ilalagay natin ang purpose para madaling maintindihan ng team.”

**Workflow Description:**

```text
Gumawa ng follow-up task at mag-email sa prospect kapag pumasok sa Qualified ang Deal.
```

*Piliin ang Deal Stage Changed na Trigger. Magdagdag ng condition.*

> “Ang Trigger natin ay Deal Stage Changed, kasi ang paglipat ng Deal ang mag-start nito.
>
> “Sa condition, piliin natin ang New Stage, then Equals, at ang Value ay Qualified. Ibig sabihin, kapag Qualified ang destination stage, saka magpo-proceed sa actions.
>
> “Yung Match all, kailangan masunod lahat ng conditions na idadagdag natin. Para sa demo na ito, isa lang muna ang rule.”

**Configuration:**

| Setting | Piliin / ilagay |
| --- | --- |
| Workflow name | Qualified Demo Follow-up |
| Trigger | Deal Stage Changed |
| Condition Field | New Stage |
| Operator | Equals |
| Value | Qualified |
| Matching | Match all |

### Action 1 — Create Task

*Magdagdag ng Create Task action.*

> “Ang unang action natin, Create Task.
>
> “Sa Associate task with, piliin natin ang Triggering deal para doon mismo naka-link ang follow-up.
>
> “Ang Task title ay ‘I-confirm ang product demo schedule.’ Sa Description, ilalagay natin ang instructions na lalabas bilang Notes ng task.”

**Task Description:**

```text
Kontakin ang prospect na naka-link sa Deal na ito.
I-confirm ang demo date, time, requirements, at mga sasali sa demo.
Ilagay ang napag-usapang schedule sa task notes.
Pagkatapos ng confirmation call, i-mark as Done ang task.
```

> “Sa Assign to, piliin natin ang Current Record Agent para yung agent ng Deal din ang makakuha ng task. Kailangan active siya at may Tasks access.
>
> “Pwede rin ang Specific User kung may particular na tao. May Role at Group din kung assignment pool ang gagamitin ng team.
>
> “Sa Due in days, ilalagay natin ang 1. So, one day mula sa pag-run ng action ang deadline. Sa Priority, High ang pipiliin natin.”

### Action 2 — Send Email

*Magdagdag ng Send Email pagkatapos ng Create Task. Sa Recipient, piliin ang Primary lead.*

> “After ma-create ang task, magpapadala naman tayo ng confirmation email.
>
> “Sa Recipient, Primary lead ang piliin natin. Sa sample Deal natin, si Maria iyon. Pwede tayong pumili ng template o maglagay ng Subject at Message dito.
>
> “Ang email na ito, manggagaling sa connected Gmail ng assigned agent ng Deal.”

**Subject:** `{{firstName}}, noted ang demo request ninyo!`

```text
Hi {{firstName}},

Salamat sa pag-confirm ng interest ninyo sa product demo!

Kokontakin kayo ng aming sales agent para ma-confirm ang preferred schedule at ang mga gusto ninyong makita sa demo.

Salamat,
Camxian Technologies Sales Team
```

**Kung SMS ang gusto mong ipakitang message action:** Piliin ang Send SMS kapalit ng Send Email, set Recipient to Primary lead, at gamitin ito:

```text
Camxian: Hi {{firstName}}! Natanggap namin ang demo request ninyo. Kokontakin kayo ng sales agent para sa schedule. Please do not reply.
```

> “Kung SMS ang gagamitin, pareho ang purpose: confirmation para sa prospect. Kailangan lang configured ang SMS sender.”

### I-check muna bago i-activate

*Click Validate, then Save draft.*

> “I-Validate muna natin para ma-check kung may kulang sa setup. Then, Save draft para ma-save ang configuration.
>
> “Next, gamitin natin ang Test. Ang chine-check nito ay yung saved version, kaya save muna tayo bago mag-test.”

*Sa Test, piliin ang prepared Qualified sample Deal sa Sample record. Sa Recorded stage transition, piliin ang current recorded transition papuntang Qualified. Click Run check.*

> “Sa Sample record, pipili tayo ng Deal na gagamiting example. Dahil stage change ang Trigger natin, pipili rin tayo ng recorded stage transition para may event na iche-check.
>
> “Then, Run check. Preview ito: makikita natin kung pasado ang conditions, sino ang magiging assignee, at ano ang magiging message. Wala pang task na ginagawa o message na ipinapadala sa test na ito.”

*I-review ang results. Kapag valid na ang setup, click Save and activate.*

> “Okay na ang setup, so Save and activate na natin. Mula rito, pwede na itong mag-process ng bagong matching events.”

*Buksan ang BrightMart - Product Demo. Ilipat mula Contacted papuntang Qualified. Bumalik sa Workflows at buksan ang View runs.*

> “Balikan natin ang Deal ni Maria at ilipat sa Qualified. Ito yung actual event na magti-trigger ng Workflow natin.
>
> “Sa View runs, makikita natin kung nag-run ang Workflow at kung successful ang bawat action. Dito rin natin iche-check kung may error. Kung kailangan ihinto ang pag-process ng future events, gamitin natin ang Pause.”

**Presenter note:** Ang agent ang nagre-record ng response at naglilipat ng Deal. Hindi Workflow triggers sa current app ang Campaign email opens, clicks, o replies. Sa Test, kailangan ang recorded transition para ma-check ang stage-event condition; hindi nito sini-simulate ang isang future stage change.

## 5. Balik sa Tasks — ipakita ang result

*Pag successful na ang run, bumalik sa Tasks. Refresh kung kailangan, then hanapin ang I-confirm ang product demo schedule.*

> “Balik tayo sa Tasks. Ito na yung follow-up na ginawa ng Workflow.
>
> “Naka-assign ito sa agent ng Deal, may deadline, at nandito na rin ang instructions. Naka-link din sa BrightMart Deal, kaya madaling balikan ang details ni Maria. Makikita rin ang task sa Tasks area ng Deal.
>
> “Kapag nakausap na ng agent si Maria, ilalagay niya sa Notes ang confirmed schedule, ise-save ang update, then Done kapag tapos na ang task.”

**Closing:**

> “So, mula sa inquiry ni Maria, na-organize natin ang gagawin sa Tasks, nakapaghanda tayo ng invitation sa Campaigns, at nagkaroon ng automatic na follow-up sa Workflows nang maging Qualified ang Deal.
>
> “Nasa isang flow na ang customer message at ang next action ng agent. Yun ang walkthrough natin for these three modules. Thank you.”

## Extra scenarios kung may magtanong

**“Paano kung hindi pa sumasagot si Maria?”**

> “Pwede tayong gumawa ng reminder Task na naka-link sa Deal at lagyan ng next follow-up date. Manual muna iyon; walang timer-based Trigger sa current Workflow setup.”

**“Paano kung lumampas na sa due date?”**

> “Lalabas sa Overdue ang active task na lampas na sa deadline at hindi pa completed o cancelled. Pwede nang balikan ng agent para mag-follow up, mag-adjust ng due date, o i-complete kung tapos na.”

**“Paano kung hindi kasama sa eligible recipients?”**

> “Check natin ang exclusion reason. Baka may kulang sa contact details o hindi pasok sa audience rules. I-update natin ang relevant record, then i-review ulit ang audience.”

**“Paano kung nag-fail ang Workflow?”**

> “Buksan natin ang View runs para makita kung aling action ang may error. Check din natin kung may naunang action na successful na bago ulitin ang operation.”

## Reference

Adapted from the [English presenter guide](presentation-tasks-campaigns-workflows.md). Pareho ang scenario at supported app behavior; conversational Taglish ang delivery at sample messages sa version na ito.
