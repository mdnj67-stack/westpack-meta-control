function isStudioSelectableStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  return status === "ACTIVE";
}

// A newly created or duplicated ad sits in Meta's review queue (status/effective_status
// like PENDING_REVIEW, IN_PROCESS or WITH_ISSUES) before it settles on ACTIVE/PAUSED.
// It is still a real, usable duplication source during that window, so ads are only
// excluded once they are actually gone (deleted or archived) rather than requiring the
// stricter "ACTIVE" bar campaigns and ad sets use.
function isDuplicatableAdStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  return status !== "" && status !== "DELETED" && status !== "ARCHIVED";
}

module.exports = {
  isStudioSelectableStatus,
  isDuplicatableAdStatus
};
