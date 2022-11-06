const toggleAnimation = (element, animation) => {
  element.src = `/src/images/link-${animation}.webp`;
};

function styleView() {
  let params = window.location.search;
  const urlParams = new URLSearchParams(params);
  const viewType = urlParams.get("F");

  const buttonView = document.querySelector("#view");

  if (viewType == 1) {
    // fancyList --> GRID
    let tableBodyElements = Array.from(
      document.querySelector("pre").children
    ).slice(5);

    buttonView.innerHTML = "📋";
    buttonView.setAttribute("title", "Table List");
    urlParams.set("F", 2);
    buttonView.addEventListener("click", () => {
      window.location.href = `?${urlParams}`;
    });

    const tableContainer = document.querySelector(".table_container");
    tableContainer.removeChild(document.querySelector("pre"));
    tableContainer.classList.add("grid_container");
    if (tableBodyElements.length <= 36) tableContainer.classList.add("fit");
    for (let i = 0; i < tableBodyElements.length; i += 2) {
      let card = document.createElement("a");
      let icon = tableBodyElements[i];
      let anchor = tableBodyElements[i + 1];
      card.href = anchor.href;
      card.classList.add("card");
      card.appendChild(icon);
      card.appendChild(anchor);
      document.querySelector(".table_container").appendChild(card);
    }

    const images = document.querySelectorAll("img");
    images.forEach((img) => {
      img.classList.add("grid");
    });
  } else {
    urlParams.set("F", 1);
    buttonView.addEventListener("click", () => {
      window.location.href = `?${urlParams}`;
    });
  }

  const anchors = document.querySelectorAll("a");
  anchors.forEach((anchor) => {
    if (!anchor.href.includes("?")) {
      //adds to all anchors the current params
      anchor.href = anchor.href + params;
    } else {
      //modify the href default of table order
      anchor.href = anchor.href.includes(";")
        ? anchor.href.replace(/;/g, "&")
        : anchor.href;
    }
  });
}

function load() {
  // MediaQueryList object
  const buttonDarkMode = document.querySelector("#darkMode");
  const buttons = document.querySelectorAll(".btn");
  const tableHead = document.querySelector(".indexhead");
  let status = localStorage.getItem("status");
  const useDark = window.matchMedia("(prefers-color-scheme: dark)");
  status =
    status == undefined ? useDark.matches : status == "false" ? false : true;

  // Toggles the "dark-mode" and update the variable in localStorage
  function toggleDarkMode(state) {
    document.documentElement.classList.toggle("dark-mode", state);
    localStorage.setItem("status", state);
    status = state;
    buttonDarkMode.innerHTML = state ? "Day ☀️" : "Night 🌙";

    buttons.forEach((b) => {
      b.classList.toggle("dark-mode-border");
      if (!status) b.classList.remove("dark-mode-border");
    });
    tableHead && tableHead.classList.toggle("dark-head");
    //remove the style when the darkmode is false
    if (!status) tableHead && tableHead.classList.remove("dark-head");
  }

  // Initial setting
  toggleDarkMode(status);

  // Toggles the "dark-mode" class on click
  buttonDarkMode.addEventListener("click", () => {
    document.documentElement.classList.toggle("dark-mode");
    toggleDarkMode(!status);
  });
  styleView();
}
window.addEventListener("DOMContentLoaded", load);
