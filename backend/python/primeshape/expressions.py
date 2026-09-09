from .geometry import clamp, ramp, signal
from .affect import RULES, apparent_affect

CATALOG = {
    "olhos_abertos": "Olhos abertos",
    "olhos_fechados": "Olhos fechados",
    "olho_esquerdo_fechado": "Olho esquerdo fechado",
    "olho_direito_fechado": "Olho direito fechado",
    "piscando": "Possível piscada em curso",
    "piscou": "Piscada observada",
    "olhos_semicerrados": "Olhos semicerrados",
    "olhos_arregalados": "Olhos arregalados",
    "boca_aberta": "Boca aberta",
    "boca_fechada": "Boca fechada",
    "boca_muito_aberta": "Boca muito aberta",
    "labios_franzidos": "Lábios franzidos",
    "labios_projetados": "Lábios projetados",
    "labios_pressionados": "Lábios pressionados",
    "sorrindo": "Sorrindo",
    "sorriso_leve": "Sorriso leve",
    "sorriso_assimetrico": "Sorriso assimétrico",
    "sobrancelhas_elevadas": "Sobrancelhas elevadas",
    "sobrancelhas_franzidas": "Sobrancelhas franzidas",
    "sobrancelha_esquerda_elevada": "Sobrancelha esquerda elevada",
    "sobrancelha_direita_elevada": "Sobrancelha direita elevada",
    "nariz_franzido": "Nariz franzido",
    "bochechas_infladas": "Bochechas infladas",
    "mandibula_esquerda": "Mandíbula deslocada à esquerda",
    "mandibula_direita": "Mandíbula deslocada à direita",
    "olhar_lateral": "Olhar lateral",
    "olhar_acima": "Olhar acima",
    "olhar_abaixo": "Olhar abaixo",
    "cabeca_girada": "Cabeça girada",
    "cabeca_inclinada": "Cabeça inclinada",
    "cabeca_frontal": "Cabeça frontal",
    "fechamento_prolongado": "Fechamento ocular prolongado",
    "possivel_bocejo": "Possível bocejo",
    "possivel_sono": "Possível sono",
    "possivel_sonolencia": "Possível sonolência",
    "vigilia_aparente": "Vigília aparente",
    "surpresa_aparente": "Expressão compatível com surpresa",
    "tensao_aparente": "Expressão compatível com tensão",
    "tristeza_aparente": "Expressão compatível com tristeza",
    "irritacao_aparente": "Expressão compatível com irritação",
    "preocupacao_aparente": "Expressão compatível com preocupação",
    "desconforto_aparente": "Possível desconforto facial",
    "atencao_aparente": "Atenção aparente",
    "neutra": "Expressão neutra",
    "relaxada_aparente": "Expressão facial relaxada",
}

CATALOG.update({code: rule["rotulo"] for code, rule in RULES.items()})


def classify_expressions(metrics, blends, timeline):
    quality = metrics["qualidade"]
    if quality < 0.4:
        return []
    result = []

    def add(code, condition, score=1.0, kind="medicao", evidence=None):
        if condition:
            result.append(signal(code, CATALOG[code], min(score, quality), kind, evidence))

    def b(name):
        return blends.get(name, 0.0)

    def pair(name):
        return min(b(name + "Left"), b(name + "Right"))

    left, right = metrics["olho_esquerdo_fechado"], metrics["olho_direito_fechado"]
    opened, closed = not left and not right, left and right
    mouth = metrics["boca_aberta"]
    smile, squint, wide = pair("mouthSmile"), pair("eyeSquint"), pair("eyeWide")
    brow_down, press, sneer = pair("browDown"), pair("mouthPress"), pair("noseSneer")
    brow_up = max(b("browInnerUp"), pair("browOuterUp"))
    yaw = abs(metrics["orientacao"]["horizontal_graus"])
    pitch = abs(metrics["orientacao"]["vertical_graus"])
    roll = abs(metrics["orientacao"]["inclinacao_graus"])
    lateral = max(min(b("eyeLookInLeft"), b("eyeLookOutRight")), min(b("eyeLookOutLeft"), b("eyeLookInRight")))
    gaze_away = max(lateral, pair("eyeLookUp"), pair("eyeLookDown"))
    add("olhos_abertos", opened, evidence=["Abertura palpebral bilateral e coeficientes oculares"])
    add("olhos_fechados", closed, evidence=["Fechamento bilateral medido"])
    add("olho_esquerdo_fechado", left and not right)
    add("olho_direito_fechado", right and not left)
    add("piscando", closed and timeline["olhos_fechados_s"] < 0.5, 0.65, "inferencia")
    add("piscou", timeline["piscada_recente"], evidence=["Fechamento seguido de reabertura em 0,06–0,65 s"])
    add("olhos_semicerrados", not closed and squint > 0.45, squint)
    add("olhos_arregalados", opened and wide > 0.45, wide)
    add("boca_aberta", mouth, evidence=["Abertura entre os lábios e deslocamento mandibular"])
    add("boca_fechada", not mouth and metrics["abertura_boca"] < 0.08)
    add("boca_muito_aberta", metrics["boca_ampla"])
    add("labios_franzidos", b("mouthPucker") > 0.5, b("mouthPucker"))
    add("labios_projetados", b("mouthFunnel") > 0.5, b("mouthFunnel"))
    add("labios_pressionados", press > 0.4 and not mouth, press)
    add("sorrindo", smile >= 0.55, smile)
    add("sorriso_leve", 0.25 <= smile < 0.55, smile)
    asymmetry = abs(b("mouthSmileLeft") - b("mouthSmileRight"))
    add("sorriso_assimetrico", asymmetry > 0.35 and max(b("mouthSmileLeft"), b("mouthSmileRight")) > 0.55, asymmetry)
    add("sobrancelhas_elevadas", brow_up > 0.45, brow_up)
    add("sobrancelhas_franzidas", brow_down > 0.45, brow_down)
    add("sobrancelha_esquerda_elevada", b("browOuterUpLeft") > 0.5 and b("browOuterUpLeft") - b("browOuterUpRight") > 0.3, b("browOuterUpLeft"))
    add("sobrancelha_direita_elevada", b("browOuterUpRight") > 0.5 and b("browOuterUpRight") - b("browOuterUpLeft") > 0.3, b("browOuterUpRight"))
    add("nariz_franzido", sneer > 0.45, sneer)
    add("bochechas_infladas", b("cheekPuff") > 0.55, b("cheekPuff"))
    add("mandibula_esquerda", b("jawLeft") > 0.45, b("jawLeft"))
    add("mandibula_direita", b("jawRight") > 0.45, b("jawRight"))
    add("olhar_lateral", opened and lateral > 0.45, lateral)
    add("olhar_acima", opened and pair("eyeLookUp") > 0.45, pair("eyeLookUp"))
    add("olhar_abaixo", opened and pair("eyeLookDown") > 0.45, pair("eyeLookDown"))
    add("cabeca_girada", yaw > 22, ramp(yaw, 12, 35))
    add("cabeca_inclinada", roll > 18, ramp(roll, 10, 30))
    add("cabeca_frontal", yaw < 15 and pitch < 18 and roll < 15)
    closed_seconds = timeline["olhos_fechados_s"]
    add("fechamento_prolongado", closed_seconds >= 1.5, evidence=[f"Olhos fechados por {closed_seconds:.1f} s"])
    add("possivel_bocejo", timeline["possivel_bocejo"], 0.7, "inferencia", ["Boca amplamente aberta por pelo menos 1,6 s", "Mandíbula aberta sem sorriso forte"])
    perclos = timeline["perclos_observado"]
    possible_sleep = closed_seconds >= 10 and perclos is not None and perclos > 0.8
    add("possivel_sono", possible_sleep, 0.65, "estado_aparente", ["Fechamento bilateral contínuo ≥ 10 s", "Fração de fechamento observada > 80%; não confirma sono"])
    add("possivel_sonolencia", not possible_sleep and perclos is not None and timeline["cobertura_s"] >= 20 and perclos > 0.35 and (closed_seconds > 1.5 or timeline["possiveis_bocejos_60s"] > 0), 0.6, "estado_aparente", ["Fechamento ocular frequente e outro sinal temporal"])
    add("vigilia_aparente", opened and gaze_away < 0.45, 0.6, "estado_aparente", ["Olhos abertos; não mede consciência"])
    add("surpresa_aparente", wide > 0.4 and brow_up > 0.4 and mouth, min(wide, brow_up, b("jawOpen")), "estado_aparente", ["Olhos ampliados, sobrancelhas elevadas e boca aberta"])
    add("tensao_aparente", brow_down > 0.4 and press > 0.3 and squint > 0.3, min(brow_down, press, squint), "estado_aparente", ["Contração de sobrancelhas, olhos e lábios"])
    frown = pair("mouthFrown")
    result.extend(apparent_affect(blends, quality))
    add("irritacao_aparente", brow_down > 0.5 and sneer > 0.35 and press > 0.3, min(brow_down, sneer, press), "estado_aparente", ["Sobrancelhas contraídas, nariz franzido e lábios pressionados"])
    add("preocupacao_aparente", b("browInnerUp") > 0.4 and brow_down > 0.3 and press > 0.3, min(b("browInnerUp"), brow_down, press), "estado_aparente", ["Elevação interna e contração das sobrancelhas com pressão labial"])
    add("desconforto_aparente", squint > 0.5 and brow_down > 0.45 and (sneer > 0.35 or press > 0.45), min(squint, brow_down, max(sneer, press)), "estado_aparente", ["Contrações combinadas; não identifica dor nem sua causa"])
    add("atencao_aparente", opened and yaw < 12 and pitch < 15 and gaze_away < 0.25, 0.55, "estado_aparente", ["Cabeça frontal e olhar central; não mede atenção cognitiva"])
    neutral = opened and not mouth and max(smile, squint, brow_down, brow_up, press, sneer, frown, b("mouthPucker")) < 0.25
    add("neutra", neutral, 1 - max(smile, brow_down, brow_up, press))
    add("relaxada_aparente", neutral and yaw < 15 and roll < 12, 0.5, "estado_aparente", ["Baixa ativação facial e postura frontal"])
    return result
