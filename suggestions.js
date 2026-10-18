// Google Forms displays the submission confirmation in a new tab.
const form = document.getElementById("suggestionForm");
const fields = {
  officerName:"1072292940",
  badge:"1389462491",
  category:"2061918619",
  details:"1686014524",
  urgency:"955589059"
};
form.action = "https://docs.google.com/forms/d/e/1FAIpQLSesv46nVGZaObODotSv-QqyqkQLUMXicukBoCO9-qOktDF9-w/formResponse";
form.method = "POST";
form.target = "_blank";
form.setAttribute("rel", "noopener");
Object.entries(fields).forEach(([id, entry]) => {
  document.getElementById(id).name = "entry." + entry;
});
