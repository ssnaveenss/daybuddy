document.addEventListener("DOMContentLoaded", () => {
  // For Daily Tasks
  document.querySelectorAll(".task-text").forEach((span) => {
    span.addEventListener("dblclick", () => {
      const form = span.nextElementSibling;
      const input = form.querySelector(".edit-input");

      span.style.display = "none";
      form.style.display = "inline";
      input.focus();
    });
  });

  document.querySelectorAll(".edit-input").forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.form.submit();
      if (e.key === "Escape") {
        input.form.style.display = "none";
        input.form.previousElementSibling.style.display = "inline";
      }
    });

    input.addEventListener("blur", () => {
      input.form.style.display = "none";
      input.form.previousElementSibling.style.display = "inline";
    });
  });

  // For Long-Term Goals
  document.querySelectorAll(".goal-text").forEach((span) => {
    span.addEventListener("dblclick", () => {
      const form = span.nextElementSibling;
      const input = form.querySelector(".goal-edit-input");

      span.style.display = "none";
      form.style.display = "inline";
      input.focus();
    });
  });

  document.querySelectorAll(".goal-edit-input").forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.form.submit();
      if (e.key === "Escape") {
        input.form.style.display = "none";
        input.form.previousElementSibling.style.display = "inline";
      }
    });

    input.addEventListener("blur", () => {
      input.form.style.display = "none";
      input.form.previousElementSibling.style.display = "inline";
    });
  });
});
