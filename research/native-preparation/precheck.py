"""v4 显式直接读包装器；无 bootstrap 读、旧 trial 重跑或 build/load。"""
_budget = None

def configure(budget):
    global _budget
    if _budget is not None and _budget is not budget:
        raise RuntimeError("TRIAL_REBIND_REFUSED")
    _budget = budget

def read(path, phase="control", *, channel="direct-fs"):
    if _budget is None:
        raise RuntimeError("EXPLICIT_SHARED_TRIAL_REQUIRED")
    return _budget.read(path, "precheck", channel=channel)[0]
