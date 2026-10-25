# LeadCRM client walkthrough — Taglish

Mga 8–10 minutes kasama ang navigation. Basahin ang naka-quote; ang naka-italic ay screen cues. Ang sample data at sending setup ay nasa [detailed Taglish guide](presentation-tasks-campaigns-workflows-taglish.md).

## Introduction

> “Hi everyone. Ipapakita ko kung paano magagamit ang Tasks, Campaigns, at Workflows sa pag-manage ng customer follow-ups ninyo.
>
> “Sa Tasks, ino-organize natin ang gagawin, kung sino ang responsible, at kailan ang deadline. Sa Campaigns, naghahanda tayo ng email o SMS para sa selected audience. Sa Workflows naman, nagse-set tayo ng automatic actions base sa rules ng team.
>
> “Para makita natin kung paano sila magkakaugnay, gamitin nating example si Maria Santos from BrightMart. Nag-inquire siya tungkol sa product demo, at gusto nating maayos ang follow-up mula inquiry hanggang sa pag-confirm ng schedule.”

## 1. Tasks: sino ang mag-aasikaso sa inquiry?

*Buksan ang Tasks → Create Task.*

> “Una, gagawa tayo ng task para may malinaw na next step ang inquiry ni Maria.
>
> “Sa Title, ilalagay natin ‘I-review ang demo inquiry ni Maria.’ Sa Notes, ilalagay natin kung ano ang kailangang i-check para alam ng agent ang gagawin.”

**Sample Notes:**

```text
I-check ang product interest at contact details ni Maria Santos.
Ihanda ang product demo invitation at i-note ang requirements niya.
```

> “Sa Assigned Agent, pipili tayo kung sino ang mag-aasikaso. Sa Due date and time, magse-set tayo ng deadline, gamit ang Philippine time.
>
> “To do muna ang Status dahil hindi pa nasisimulan. High ang Priority para makita ng agent na kailangan itong unahin.
>
> “Ili-link din natin ang task sa BrightMart - Product Demo na Deal. Ang Deal ang sales opportunity na sinusundan natin, kaya may customer context ang follow-up na ito.”

*Piliin ang Deal sa Associate task to deal, then click Create task.*

> “Saved na ang task. Kapag may update, pwede nating i-edit ang Notes o Status. Kapag tapos na ang review, click Done.
>
> “Kung maraming tasks, may Search at Filters para mahanap ang specific agent, status, o priority. May Today at Overdue din para makita kung alin ang dapat balikan.”

*Ipakita ang saved Task at ang Done button.*

> “Ngayong malinaw na kung sino ang magre-review ng inquiry, ihanda naman natin ang invitation.”

## 2. Campaigns: paano natin kokontakin ang prospect?

*Buksan ang Campaigns → Create Campaign.*

> “Sa Campaigns, pwede tayong maghanda ng message para sa mga prospect na interesado sa product demo.
>
> “Ang Campaign Name natin ay ‘Product Demo Invitation - Email.’ Internal name ito para madaling mahanap sa list. Sa Type, Email muna ang piliin natin.
>
> “Sa Target Audience, pipiliin natin ang Product Demo Leads. Ito yung saved audience na may rules kung sinong Leads ang kasama. Sa Eligible Recipients, makikita natin kung sino ang pasok at kung may excluded na kailangang i-check.”

*Piliin ang audience. Ilagay ang Subject Line at Body.*

> “Yung Subject Line ang unang makikita sa inbox ng recipient. Sa Body naman ilalagay ang buong invitation.”

**Subject Line:** `{{firstName}}, schedule tayo ng product demo?`

```text
Hi {{firstName}},

Salamat sa interest ninyo sa Camxian Technologies!

Pwede tayong mag-schedule ng short product demo para mapag-usapan ang kailangan ng business ninyo at maipakita kung paano makakatulong ang product.

Ipaalam lang sa inyong Camxian sales agent kung anong araw at oras ang convenient sa inyo.

Salamat,
Camxian Technologies Sales Team
```

*Ipakita ang Insert Variable at live preview.*

> “Sa Insert Variable, pwede nating gamitin ang firstName mula sa CRM record. Kaya sa message ni Maria, magiging ‘Hi Maria’ ang greeting.
>
> “I-check natin sa preview kung tama ang pangalan at maayos ang message. Then, Save Draft muna para ma-save ang preparation natin.”

### SMS reminder

*Gumawa ng second Campaign: Product Demo Invitation - SMS. Piliin ang SMS at ang parehong demo audience.*

> “Para sa maikling reminder, pwede rin tayong gumawa ng SMS Campaign. Hiwalay ito sa Email Campaign, at diretso sa Body ang message.”

```text
Hi {{firstName}}! Na-email na namin ang product demo invite. Contact your Camxian sales agent para sa schedule. Please do not reply.
```

> “May character at segment counter para ma-check natin ang haba ng message. Review din natin kung may footer na sa Body bago i-save.”

*I-save ang SMS draft. Ipakita ang Send menu sa isang draft.*

> “Kapag ready na, Send Now para i-submit ang Campaign for sending. Kung may preferred date at time, gamitin ang Schedule Send para sa isang future send.
>
> “Pwede ring i-save ang message bilang Email o SMS Template para magamit ulit sa susunod.”

*Kung may prepared sent Campaign, buksan ang report.*

> “Sa report, makikita natin ang recorded recipient results. Submitted means tinanggap na ng sending provider ang message. Delivered means may delivery confirmation na.”

## 3. Workflows: ano ang susunod kapag interesado na si Maria?

> “Sa next part ng example natin, sabihin nating nag-confirm si Maria na gusto niyang mag-proceed sa demo.
>
> “Ire-record ng agent ang response niya sa Deal. Ang gusto natin, kapag inililipat na sa Qualified ang opportunity, automatic na may task para i-confirm ang schedule. Ang Qualified dito, na-assess na ng team na pasok ang opportunity at ready na sa next step.
>
> “Ise-set up muna natin iyon sa Workflows.”

*Buksan ang Workflows → Create Workflow → Start from scratch.*

> “Pangalanan natin itong ‘Qualified Demo Follow-up.’ May tatlong parts ang setup: Trigger, Conditions, at Actions.
>
> “Ang Trigger ang event na magsisimula ng check. Ang Condition ang rule na kailangang ma-meet. Ang Actions ang gagawin kapag pasok sa rule.”

| Setting | Configuration |
| --- | --- |
| Workflow name | Qualified Demo Follow-up |
| Trigger | Deal Stage Changed |
| Condition Field | New Stage |
| Operator | Equals |
| Value | Qualified |
| Matching | Match all |

> “Deal Stage Changed ang Trigger. Sa condition, New Stage equals Qualified. Ibig sabihin, kapag Qualified ang destination stage, saka magpo-proceed sa actions.”

### Unang action: Create Task

*Magdagdag ng Create Task.*

> “Una, gagawa tayo ng task na ‘I-confirm ang product demo schedule.’ Sa Associate task with, Triggering deal ang piliin para konektado ito sa Deal na nag-start ng Workflow.
>
> “Sa Assign to, Current Record Agent para yung agent ng Deal din ang mag-follow up. Sa Due in days, 1 para may deadline one day mula sa execution. High ang Priority.”

**Task Description / Notes:**

```text
Kontakin ang prospect na naka-link sa Deal.
I-confirm ang demo date, time, requirements, at mga sasali.
I-save ang agreed schedule sa task notes, then mark as Done pagkatapos ng call.
```

### Pangalawang action: Send Email

*Magdagdag ng Send Email pagkatapos ng Create Task. Piliin ang Primary lead sa Recipient.*

> “Next, confirmation email naman. Primary lead ang Recipient; sa sample Deal natin, si Maria iyon. Ang email na ito ay manggagaling sa connected Gmail ng assigned agent.”

**Subject:** `{{firstName}}, noted ang demo request ninyo!`

```text
Hi {{firstName}},

Salamat sa pag-confirm ng interest ninyo sa product demo!

Kokontakin kayo ng aming sales agent para ma-confirm ang preferred schedule at ang mga gusto ninyong makita sa demo.

Salamat,
Camxian Technologies Sales Team
```

**Optional SMS alternative:** Gamitin ang Send SMS kapalit ng Send Email, then piliin ang Primary lead.

```text
Camxian: Hi {{firstName}}! Natanggap namin ang demo request ninyo. Kokontakin kayo ng sales agent para sa schedule. Please do not reply.
```

### I-test at i-activate

*Click Validate → Save draft → Test. Piliin ang prepared sample Deal at ang current recorded transition nito papuntang Qualified, then Run check.*

> “I-Validate muna natin para makita kung may kulang sa configuration, then Save draft.
>
> “Sa Test, pipili tayo ng sample Deal at recorded stage transition para ma-check ang setup. Yung Run check, preview lang: wala pang task na ginagawa o email na ipinapadala.
>
> “Kapag okay na, Save and activate para gumana ito sa mga susunod na matching events.”

*Ilipat ang BrightMart - Product Demo mula Contacted papuntang Qualified. Buksan ang View runs sa Workflow.*

> “Ngayon, ilipat natin ang Deal ni Maria sa Qualified. Ito na yung event na mag-start ng actual run.
>
> “Sa View runs, makikita natin ang result ng bawat action. Dito rin natin iche-check kung may error. Kung kailangang ihinto ang future processing, may Pause.”

## 4. Balik sa Tasks: ipakita ang result

*Kapag successful na ang run, bumalik sa Tasks. Refresh kung kailangan. Hanapin ang I-confirm ang product demo schedule at buksan ito.*

> “Ito na yung task na ginawa ng Workflow. May assigned agent, deadline, instructions, at link sa BrightMart Deal.
>
> “Pagkatapos makausap si Maria, ilalagay ng agent ang confirmed schedule sa Notes, ise-save ang update, then Done kapag tapos na ang follow-up.”

## Closing

> “Sa example natin, may malinaw na follow-up mula inquiry hanggang sa pag-confirm ng demo. Alam ng team kung sino ang responsible, ano ang naihandang message, at ano ang susunod na gagawin.
>
> “Ganyan magagamit ang Tasks, Campaigns, at Workflows sa day-to-day sales process ninyo. May part ba kayong gustong balikan natin?”

## Notes para sa presenter

- Kung drafts lang ang Campaigns, i-frame bilang scenario ang pag-receive at response ni Maria. Gumamit ng prepared sent Campaign para sa report.
- Ang agent ang magre-record ng response at maglilipat ng Deal. Campaign opens, clicks, at replies are not current Workflow triggers.
- Para sa stage-event test, gumamit ng sample Deal na may current recorded transition into Qualified. Hindi nagpe-perform ng future transition ang Run check.
- Kailangan ng configured Campaign senders, authorized connected Gmail para sa Workflow email, at eligible Task assignee para sa live actions. Ang Create Task action ay para sa Deal triggers.
- Pumili ng ibang pangalan, Product, at scenario kung mas malapit iyon sa actual business ng client.
