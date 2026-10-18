// Submit directly to Google Forms so its confirmation page verifies receipt.
const form = document.getElementById("complaintForm");
const fields = {
  type:"1451334158",
  reported:"1748522971",
  location:"1853307124",
  details:"2136502571",
  witnesses:"1655157784",
  evidence:"204631976",
  severity:"993186963",
  anonymous:"901663230",
  badge:"2128315592"
};
form.action = "https://docs.google.com/forms/d/e/1FAIpQLSet1cnBnfbaxf7TD3h7T4rnAb3pgWjJ0u6UL38z6pFjIKDU-w/formResponse";
form.method = "POST";
form.target = "_blank";
form.setAttribute("rel", "noopener");
Object.entries(fields).forEach(([id, entry]) => {
  document.getElementById(id).name = "entry." + entry;
});
