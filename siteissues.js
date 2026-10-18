// Google Forms displays the submission confirmation in a new tab.
const form = document.getElementById("siteIssueForm");
const fields = {
  reporterName:"1116509970",
  discordUsername:"2089595990",
  issuePage:"1231695954",
  issueDescription:"1901632737",
  issueSteps:"419525951",
  issueScreenshotLinks:"1532782486"
};
form.action = "https://docs.google.com/forms/d/e/1FAIpQLSekkz8xCF1Us8R5KyIUod1X_tFJPS2xk99Mh1Rh3oeq5FRWEg/formResponse";
form.method = "POST";
form.target = "_blank";
form.setAttribute("rel", "noopener");
Object.entries(fields).forEach(([id, entry]) => {
  document.getElementById(id).name = "entry." + entry;
});
form.querySelectorAll('input[name="issueType"]').forEach(input => {
  input.name = "entry.760392305";
});
