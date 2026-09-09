from collections import deque
from .config import SETTINGS
from .affect import AffectTracker


class FaceTimeline:
    def __init__(self):
        self.reset()

    def reset(self):
        self.previous = None
        self.closed_since = None
        self.wide_since = None
        self.blink_until = 0.0
        self.yawn_until = 0.0
        self.blinks = deque()
        self.yawns = deque()
        self.intervals = deque()
        self.was_closed = False
        self.yawn_recorded = False
        self.anchor = None
        self.affect = AffectTracker()

    def update(self, metrics, now):
        if metrics is None or metrics["qualidade"] < 0.4:
            self.reset()
            return self.result(now)
        x, y, w, h = metrics["caixa"]
        anchor = (x + w / 2, y + h / 2, w)
        if self.anchor:
            old_x, old_y, old_w = self.anchor
            if abs(anchor[0] - old_x) + abs(anchor[1] - old_y) > max(old_w, 0.12) or abs(w - old_w) > old_w * 0.6:
                self.reset()
        if self.previous is not None and (now <= self.previous or now - self.previous > SETTINGS.max_observation_gap):
            self.reset()
        self.anchor = anchor
        closed = metrics["olho_esquerdo_fechado"] and metrics["olho_direito_fechado"]
        if self.previous is not None:
            self.intervals.append((self.previous, now, self.was_closed))
        if closed:
            if self.closed_since is None:
                self.closed_since = now
        elif self.closed_since is not None:
            duration = now - self.closed_since
            if 0.06 <= duration <= 0.65:
                self.blinks.append(now)
                self.blink_until = now + 0.5
            self.closed_since = None
        if metrics["boca_ampla"]:
            if self.wide_since is None:
                self.wide_since = now
            if now - self.wide_since >= 1.6 and not self.yawn_recorded:
                self.yawns.append(now)
                self.yawn_recorded = True
            if self.yawn_recorded:
                self.yawn_until = now + 0.8
        else:
            self.wide_since = None
            self.yawn_recorded = False
        self.previous, self.was_closed = now, closed
        for queue in (self.blinks, self.yawns):
            while queue and queue[0] < now - 60:
                queue.popleft()
        while self.intervals and self.intervals[0][1] <= now - 60:
            self.intervals.popleft()
        return self.result(now)

    def result(self, now):
        durations = [(max(0.0, end - max(start, now - 60)), closed) for start, end, closed in self.intervals]
        covered = sum(duration for duration, _ in durations)
        closed_time = sum(duration for duration, closed in durations if closed)
        perclos = closed_time / covered if covered >= 10 else None
        return {
            "olhos_fechados_s": round(now - self.closed_since, 2) if self.closed_since is not None else 0.0,
            "boca_ampla_s": round(now - self.wide_since, 2) if self.wide_since is not None else 0.0,
            "piscada_recente": now < self.blink_until,
            "possivel_bocejo": now < self.yawn_until,
            "piscadas_60s": len(self.blinks),
            "possiveis_bocejos_60s": len(self.yawns),
            "perclos_observado": round(perclos, 3) if perclos is not None else None,
            "cobertura_s": round(covered, 2),
        }
