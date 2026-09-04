const AIRPORTS = [
  ["Greater Rockford Airport", "Greater Rockford"],
  ["Perth International", "Perth"],
  ["Tokyo International Airport", "Orenji"],
  ["Larnaca Airport", "Cyprus"],
  ["Izolirani International", "Izolirani"],
  ["Keflavik Airport", "Grindavik"],
  ["Sauthemptona Airport", "Sauthemptona"],
  ["Paphos Airport", "Cyprus"],
  ["Barra Airport", "Cyprus"],
  ["Saba Airport", "Orenji"],
  ["Lukla", "Perth"],
  ["Pingeyri Airport", "Grindavik"],
  ["Skopelos Airfield", "Skopelos"],
  ["Saint Barthélemy Airport", "Saint Barthélemy"],
  ["Henstridge Airfield", "Cyprus"],
  ["Airbase Garry", "Greater Rockford"],
  ["RAF Scampton", "Izolirani"],
  ["McConnell AFB", "Cyprus"],
  ["HMS Queen Elizabeth", "Off Greater Rockford"]
];

function populateAirports() {
  const origin = document.querySelector("#origin");
  const destination = document.querySelector("#destination");
  if (!origin || !destination) return;

  AIRPORTS.forEach(([name, region]) => {
    const label = `${name} · ${region}`;
    const a = new Option(label, name);
    const b = new Option(label, name);
    origin.add(a);
    destination.add(b);
  });
}
populateAirports();

const form = document.querySelector("#bookingForm");
const message = document.querySelector("#formMessage");
const dateInput = document.querySelector("#flightDate");
const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector("#navLinks");

const today = new Date();
const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
if (dateInput) dateInput.min = localToday;

menuToggle?.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
});

document.querySelectorAll("#navLinks a").forEach(a => a.addEventListener("click", () => {
  navLinks.classList.remove("open");
  menuToggle?.setAttribute("aria-expanded", "false");
}));

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("in-view");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll(".reveal").forEach(el => observer.observe(el));

function clearErrors() {
  document.querySelectorAll(".field").forEach(field => {
    field.classList.remove("invalid");
    const error = field.querySelector(".field-error");
    if (error) error.textContent = "";
  });
}

function showFieldErrors(fields = {}) {
  Object.entries(fields).forEach(([name, text]) => {
    const input = form.elements[name];
    const field = input?.closest(".field");
    if (!field) return;
    field.classList.add("invalid");
    const error = field.querySelector(".field-error");
    if (error) error.textContent = text;
  });
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearErrors();
  message.textContent = "";

  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  submit.innerHTML = "Sending request <span>…</span>";

  try {
    const payload = Object.fromEntries(new FormData(form).entries());
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      showFieldErrors(result.fields);
      message.textContent = result.error || "Please check your details.";
      return;
    }

    form.reset();
    dateInput.min = localToday;
    message.textContent = `Request received. Your reference is ${result.bookingId}. Atlas Elite will review your request.`;
    message.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch {
    message.textContent = "We could not reach the operations system. Please try again.";
  } finally {
    submit.disabled = false;
    submit.innerHTML = "Submit Flight Request <span>→</span>";
  }
});

form?.querySelectorAll("input, select, textarea").forEach(input => {
  input.addEventListener("input", () => {
    const field = input.closest(".field");
    field?.classList.remove("invalid");
    const error = field?.querySelector(".field-error");
    if (error) error.textContent = "";
  });
});
