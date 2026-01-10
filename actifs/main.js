(function () {
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  const map = {
    "index.html": "nav-home",
    "services.html": "nav-services",
    "tarifs.html": "nav-tarifs",
    "a-propos.html": "nav-apropos",
    "contact.html": "nav-contact",
    "mention-legales.html": "nav-legal",
  };

  const id = map[path];
  if (id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("active");
  }
})();
