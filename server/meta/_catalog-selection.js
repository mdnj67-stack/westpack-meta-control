function isStudioSelectableStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  return status === "ACTIVE";
}

module.exports = {
  isStudioSelectableStatus
};
