const LABELS: Record<string, string> = {
  "problem.approve": "approved a problem",
  "problem.reject": "rejected a problem",
  "problem.resolve": "marked a problem resolved",
  "problem.archive": "archived a problem",
  "solution.accept": "accepted a solution",
  "solution.reject": "rejected a solution",
  "solution.request_changes": "requested changes on a solution",
  "user.grant_admin": "made a user admin",
  "user.revoke_admin": "removed admin access",
  "category.create": "created a category",
  "category.update": "updated a category",
};

export function actionLabel(action: string) {
  return LABELS[action] ?? action;
}
