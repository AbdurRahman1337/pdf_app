import json
import logging
import uuid
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import get_session_id
from app.core.llm_client import llm_client
from app.db.vector_store import vector_store
from app.db.firestore_service import firestore_service
from app.core.prompt_builder import format_context_blocks

router = APIRouter(tags=["Exam Prep - MDCAT Testing"])
logger = logging.getLogger(__name__)

# ── Schemas ──────────────────────────────────────────────────────────────────

class ExamTopic(BaseModel):
    id: str
    name: str
    weightage: str
    questions_count: int
    icon: Optional[str] = None


class ExamInfo(BaseModel):
    id: str
    code: str
    title: str
    region: str
    description: str
    total_marks: int
    duration_minutes: int
    negative_marking: float
    passing_criteria: str
    syllabus_topics: List[ExamTopic]
    past_years: List[int]
    is_pro_only: bool = False


class ExamQuestionItem(BaseModel):
    id: int
    exam_id: str
    subject: str
    topic: str
    question: str
    options: List[str]
    correct_answer: str
    explanation: str
    difficulty: str  # "Easy" | "Medium" | "Hard"
    source_reference: Optional[str] = None


class ExamGenerateRequest(BaseModel):
    exam_id: str = "mdcat_pakistan"
    mode: str = "practice"  # "practice" | "mock"
    subject: Optional[str] = None
    topic: Optional[str] = None
    selected_doc_ids: Optional[List[str]] = None
    selected_subject_names: Optional[List[str]] = None
    num_questions: int = 10
    difficulty: Optional[str] = None


class ExamGenerateResponse(BaseModel):
    exam_id: str
    exam_title: str
    mode: str
    duration_seconds: int
    negative_marking: float
    total_questions: int
    source_documents: List[str] = Field(default_factory=list)
    questions: List[ExamQuestionItem]


class WeakAreaReportRequest(BaseModel):
    exam_id: str = "mdcat_pakistan"
    user_answers: Dict[int, str]
    questions: List[ExamQuestionItem]
    time_spent_seconds: int = 0


class TopicMastery(BaseModel):
    topic: str
    subject: str
    total_questions: int
    correct_count: int
    accuracy_percentage: float
    status: str  # "Mastered" | "Proficient" | "Needs Revision" | "Critical Weakness"


class WeakAreaReportResponse(BaseModel):
    exam_id: str
    overall_score: float
    max_score: float
    accuracy_percentage: float
    net_score_with_negative_marking: float
    readiness_index_percentage: float
    total_correct: int
    total_incorrect: int
    total_unanswered: int
    topic_breakdown: List[TopicMastery]
    critical_weak_spots: List[str]
    ai_remediation_summary: str
    recommended_focus_topics: List[str]


# ── Sole Standard Exam: MDCAT (Medical & Dental College Admission Test) ──────

MDCAT_EXAM = ExamInfo(
    id="mdcat_pakistan",
    code="MDCAT",
    title="MDCAT Medical & Dental Admission Test",
    region="Pakistan",
    description="Official PMDC/UHS Medical & Dental College Admission Test. Covers Biology (68 MCQs), Chemistry (54 MCQs), Physics (54 MCQs), English (18 MCQs), and Logical Reasoning (6 MCQs).",
    total_marks=200,
    duration_minutes=210,  # 3.5 hours
    negative_marking=0.0,
    passing_criteria="65% MBBS qualifying cut-off (130/200), 55% BDS qualifying cut-off (110/200)",
    syllabus_topics=[
        ExamTopic(id="mdcat_bio", name="Biology", weightage="34%", questions_count=68),
        ExamTopic(id="mdcat_chem", name="Chemistry", weightage="27%", questions_count=54),
        ExamTopic(id="mdcat_phy", name="Physics", weightage="27%", questions_count=54),
        ExamTopic(id="mdcat_eng", name="English", weightage="9%", questions_count=18),
        ExamTopic(id="mdcat_logic", name="Logical Reasoning", weightage="3%", questions_count=6),
    ],
    past_years=[2024, 2023, 2022, 2021, 2020],
)

EXAM_CATALOG: List[ExamInfo] = [MDCAT_EXAM]


# ── MDCAT Seed Question Bank (High-Yield PMDC Syllabus) ──────────────────────

MDCAT_SEED_QUESTIONS: List[ExamQuestionItem] = [
    # ── Biology ──
    ExamQuestionItem(
        id=101,
        exam_id="mdcat_pakistan",
        subject="Biology",
        topic="Cell Biology & Organelles",
        question="Which organelle is responsible for the synthesis of ribosomal RNA (rRNA) and the assembly of ribosomal subunits inside eukaryotic cells?",
        options=["Nucleolus", "Golgi Apparatus", "Smooth Endoplasmic Reticulum", "Lysosome"],
        correct_answer="Nucleolus",
        explanation="The nucleolus is the distinct non-membrane bound sub-nuclear structure dedicated to the transcription and processing of rRNA and assembly into pre-ribosomal particles.",
        difficulty="Easy",
        source_reference="MDCAT Biology - Cell Biology"
    ),
    ExamQuestionItem(
        id=102,
        exam_id="mdcat_pakistan",
        subject="Biology",
        topic="Bioenergetics & Respiration",
        question="During aerobic cellular respiration, where in the mitochondrion does the Krebs cycle (Citric Acid Cycle) take place?",
        options=["Mitochondrial Matrix", "Inner Mitochondrial Membrane", "Intermembrane Space", "Outer Mitochondrial Membrane"],
        correct_answer="Mitochondrial Matrix",
        explanation="The Krebs cycle reactions take place within the fluid mitochondrial matrix, whereas oxidative phosphorylation occurs on the cristae of the inner mitochondrial membrane.",
        difficulty="Medium",
        source_reference="MDCAT Biology - Bioenergetics"
    ),
    ExamQuestionItem(
        id=103,
        exam_id="mdcat_pakistan",
        subject="Biology",
        topic="Genetics & DNA",
        question="In a dihybrid cross between two heterozygous individuals (AaBb x AaBb), what is the expected phenotypic ratio among the offspring according to Mendel's Law of Independent Assortment?",
        options=["9:3:3:1", "1:2:1", "3:1", "9:7"],
        correct_answer="9:3:3:1",
        explanation="A classic Mendelian dihybrid cross of two heterozygous parents for independently assorting non-linked genes produces the 9:3:3:1 phenotypic ratio.",
        difficulty="Easy",
        source_reference="MDCAT Biology - Genetics"
    ),
    ExamQuestionItem(
        id=104,
        exam_id="mdcat_pakistan",
        subject="Biology",
        topic="Human Physiology & Circulation",
        question="Which heart valve prevents the backflow of oxygenated blood from the left ventricle into the left atrium during ventricular systole?",
        options=["Bicuspid (Mitral) Valve", "Tricuspid Valve", "Aortic Semilunar Valve", "Pulmonary Semilunar Valve"],
        correct_answer="Bicuspid (Mitral) Valve",
        explanation="The bicuspid (mitral) valve guards the left atrioventricular orifice, closing during ventricular systole to prevent regurgitation into the left atrium.",
        difficulty="Medium",
        source_reference="MDCAT Biology - Human Circulation"
    ),

    # ── Chemistry ──
    ExamQuestionItem(
        id=201,
        exam_id="mdcat_pakistan",
        subject="Chemistry",
        topic="Organic Chemistry - Reaction Mechanisms",
        question="In an SN2 nucleophilic substitution reaction on a chiral carbon center, what stereochemical outcome is observed?",
        options=["100% Inversion of Configuration (Walden Inversion)", "100% Retention of Configuration", "50:50 Racemization", "No change in optical activity"],
        correct_answer="100% Inversion of Configuration (Walden Inversion)",
        explanation="SN2 occurs via a concerted backside attack by the nucleophile opposite to the leaving group, causing a complete inversion of configuration (Walden Inversion).",
        difficulty="Medium",
        source_reference="MDCAT Chemistry - Alkyl Halides"
    ),
    ExamQuestionItem(
        id=202,
        exam_id="mdcat_pakistan",
        subject="Chemistry",
        topic="Physical Chemistry - Chemical Equilibrium",
        question="According to Le Chatelier's Principle, for the exothermic Haber process: N2(g) + 3H2(g) <=> 2NH3(g) (ΔH = -92 kJ/mol), what condition maximizes the yield of ammonia?",
        options=["High Pressure and Low Temperature", "Low Pressure and High Temperature", "High Temperature only", "Low Pressure and Low Temperature"],
        correct_answer="High Pressure and Low Temperature",
        explanation="Since forward reaction reduces gas moles (4 moles -> 2 moles) and releases heat, higher pressure and moderate low temperature shift equilibrium towards ammonia.",
        difficulty="Medium",
        source_reference="MDCAT Chemistry - Chemical Equilibrium"
    ),
    ExamQuestionItem(
        id=203,
        exam_id="mdcat_pakistan",
        subject="Chemistry",
        topic="Atomic Structure & Periodic Table",
        question="Which quantum number designates the spatial orientation of an atomic orbital in a magnetic field?",
        options=["Magnetic Quantum Number (m)", "Principal Quantum Number (n)", "Azimuthal Quantum Number (l)", "Spin Quantum Number (s)"],
        correct_answer="Magnetic Quantum Number (m)",
        explanation="The magnetic quantum number 'm' (or ml) specifies the orientation in space of an orbital with values ranging from -l to +l.",
        difficulty="Easy",
        source_reference="MDCAT Chemistry - Atomic Structure"
    ),

    # ── Physics ──
    ExamQuestionItem(
        id=301,
        exam_id="mdcat_pakistan",
        subject="Physics",
        topic="Work, Energy & Power",
        question="If the linear momentum of a particle is increased by 100%, by what percentage does its kinetic energy (K.E.) increase?",
        options=["300%", "100%", "200%", "400%"],
        correct_answer="300%",
        explanation="K.E. = P^2 / (2m). If P doubles (2P), new K.E.' = (2P)^2 / (2m) = 4 * K.E. The percentage increase = ((4 - 1)/1) * 100% = 300%.",
        difficulty="Hard",
        source_reference="MDCAT Physics - Mechanics"
    ),
    ExamQuestionItem(
        id=302,
        exam_id="mdcat_pakistan",
        subject="Physics",
        topic="Electromagnetism & Circuits",
        question="Two point charges of +2 μC and +8 μC are separated by a distance 'd'. At what point along the line joining them is the net electric field intensity zero?",
        options=["At d/3 from the +2 μC charge", "At d/2 midway", "At d/4 from the +2 μC charge", "At 2d/3 from the +2 μC charge"],
        correct_answer="At d/3 from the +2 μC charge",
        explanation="Setting E1 = E2: k*q1/x^2 = k*q2/(d-x)^2 -> sqrt(2)/x = sqrt(8)/(d-x) = 2*sqrt(2)/(d-x) -> 2x = d - x -> 3x = d -> x = d/3.",
        difficulty="Hard",
        source_reference="MDCAT Physics - Electrostatics"
    ),

    # ── English ──
    ExamQuestionItem(
        id=401,
        exam_id="mdcat_pakistan",
        subject="English",
        topic="Vocabulary & Sentence Completion",
        question="Choose the word most nearly OPPOSITE in meaning (ANTONYM) to 'METICULOUS':",
        options=["Careless / Sloppy", "Precise / Exact", "Painstaking", "Thorough"],
        correct_answer="Careless / Sloppy",
        explanation="'Meticulous' means showing great attention to detail; very careful and precise. Its exact antonym is careless, negligent, or sloppy.",
        difficulty="Easy",
        source_reference="MDCAT English - Antonyms"
    ),

    # ── Logical Reasoning ──
    ExamQuestionItem(
        id=501,
        exam_id="mdcat_pakistan",
        subject="Logical Reasoning",
        topic="Critical Deduction",
        question="Statement: 'All enzymes are biological catalysts. Some proteins are enzymes.' Conclusion: 'Therefore, all biological catalysts are proteins.' Is this conclusion logically valid?",
        options=["Invalid (False conclusion)", "Valid (True deduction)", "Cannot be determined", "Valid only in human physiology"],
        correct_answer="Invalid (False conclusion)",
        explanation="The conclusion commits the fallacy of converse/undistributed middle; ribozymes (RNA molecules) are also biological catalysts, not proteins.",
        difficulty="Medium",
        source_reference="MDCAT Logical Reasoning"
    ),
]


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/exam-prep/exams", response_model=List[ExamInfo])
async def list_available_exams():
    """
    Returns MDCAT as the sole official exam track.
    """
    return EXAM_CATALOG


@router.get("/exam-prep/exams/{exam_id}", response_model=ExamInfo)
async def get_exam_details(exam_id: str):
    """
    Returns syllabus topics, question distribution, and rules for MDCAT.
    """
    return MDCAT_EXAM


@router.post("/exam-prep/generate-test", response_model=ExamGenerateResponse)
async def generate_exam_test(
    payload: ExamGenerateRequest,
    session_id: str = Depends(get_session_id)
):
    """
    Generates an authentic MDCAT test session using AI grounded in:
    1. Selected course contents / documents uploaded by the student in Course Hub.
    2. Selected MDCAT subjects (Biology, Chemistry, Physics, English, Logical Reasoning).
    """
    needed_count = max(3, min(payload.num_questions, 50))
    selected_questions: List[ExamQuestionItem] = []
    source_docs_used: List[str] = []

    # 1. Retrieve actual content from vector store if selected_doc_ids provided
    doc_context_text = ""
    if payload.selected_doc_ids:
        for doc_id in payload.selected_doc_ids[:8]:
            chunks = vector_store.get_document_chunks(doc_id)
            if chunks:
                doc_context_text += f"\n--- Course Document Content ({doc_id}) ---\n"
                doc_context_text += "\n".join([c["text"] for c in chunks[:5]])[:4000]
                fn = chunks[0]["metadata"].get("filename", doc_id)
                source_docs_used.append(fn)

    # 2. Match seed questions for subject if applicable
    target_subject = payload.subject or (payload.selected_subject_names[0] if payload.selected_subject_names else None)
    if target_subject and target_subject.lower() != "all":
        matching_seeds = [q for q in MDCAT_SEED_QUESTIONS if target_subject.lower() in q.subject.lower()]
    else:
        matching_seeds = list(MDCAT_SEED_QUESTIONS)

    # 3. Use LLM to generate realistic questions grounded in student's course materials
    subject_prompt_label = target_subject or (", ".join(payload.selected_subject_names) if payload.selected_subject_names else "Biology, Chemistry, Physics, English, Logical Reasoning")

    prompt = (
        "You are an expert medical college entrance examination board setter for the official MDCAT (PMDC/UHS standard).\n"
        f"Generate exactly {needed_count} authentic, conceptual, and rigorous Multiple Choice Questions (MCQs) for MDCAT.\n"
        f"Subject / Syllabus Focus: {subject_prompt_label}\n"
    )

    if doc_context_text:
        prompt += f"\nGround the questions directly in the student's uploaded course materials below:\n{doc_context_text}\n"
    else:
        prompt += "\nGround the questions strictly in the PMDC MDCAT syllabus (FSc Pre-Medical curriculum).\n"

    prompt += (
        "\nRequirements for each question:\n"
        "1. Real MDCAT difficulty (concept-based, clinical application, or numerical problem solving).\n"
        "2. 4 distinct options (A, B, C, D) with plausible distractors.\n"
        "3. Clear correct_answer matching one of the options.\n"
        "4. In-depth pedagogical explanation explaining why the correct option is right.\n"
        "5. difficulty ('Easy' | 'Medium' | 'Hard').\n"
        "6. source_reference (e.g. 'MDCAT Biology - Cell Structure' or 'Course Notes Excerpt').\n\n"
        "Return valid JSON ONLY formatted as:\n"
        "{\n"
        '  "questions": [\n'
        '    {\n'
        '      "subject": "Biology",\n'
        '      "topic": "Cell Structure & Function",\n'
        '      "question": "Question text...",\n'
        '      "options": ["Option A", "Option B", "Option C", "Option D"],\n'
        '      "correct_answer": "Option A",\n'
        '      "explanation": "Detailed rationale...",\n'
        '      "difficulty": "Medium",\n'
        '      "source_reference": "MDCAT Syllabus"\n'
        '    }\n'
        '  ]\n'
        "}"
    )

    try:
        raw = await llm_client.generate(prompt, temperature=0.3)
        json_str = raw.strip()
        if "```" in json_str:
            parts = json_str.split("```")
            json_str = parts[1].replace("json", "").strip() if len(parts) > 1 else json_str

        parsed = json.loads(json_str)
        raw_qs = parsed.get("questions", [])

        for idx, rq in enumerate(raw_qs):
            opts = rq.get("options", ["A", "B", "C", "D"])
            selected_questions.append(
                ExamQuestionItem(
                    id=idx + 1,
                    exam_id="mdcat_pakistan",
                    subject=rq.get("subject", target_subject or "Biology"),
                    topic=rq.get("topic", "MDCAT Core Topic"),
                    question=rq.get("question", f"MDCAT Concept Question {idx + 1}"),
                    options=[str(o) for o in opts],
                    correct_answer=rq.get("correct_answer", opts[0] if opts else "Option A"),
                    explanation=rq.get("explanation", "Review MDCAT course notes for full rationale."),
                    difficulty=rq.get("difficulty", "Medium"),
                    source_reference=rq.get("source_reference", "MDCAT Syllabus")
                )
            )
            if len(selected_questions) >= needed_count:
                break
    except Exception as e:
        logger.warning(f"AI test generation fallback: {e}")

    # Fallback to seed questions if LLM failed or returned fewer questions
    if len(selected_questions) < needed_count:
        for sq in matching_seeds:
            cloned = sq.copy()
            cloned.id = len(selected_questions) + 1
            selected_questions.append(cloned)
            if len(selected_questions) >= needed_count:
                break

    duration_sec = 210 * 60 if payload.mode == "mock" else len(selected_questions) * 90

    return ExamGenerateResponse(
        exam_id="mdcat_pakistan",
        exam_title="MDCAT Medical & Dental Admission Test",
        mode=payload.mode,
        duration_seconds=duration_sec,
        negative_marking=0.0,
        total_questions=len(selected_questions),
        source_documents=source_docs_used,
        questions=selected_questions
    )


@router.post("/exam-prep/analyze-weak-areas", response_model=WeakAreaReportResponse)
async def analyze_weak_areas(payload: WeakAreaReportRequest):
    """
    Calculates MDCAT Weak-Area Diagnostics:
    - Subject and topic mastery breakdown (% accuracy, speed)
    - Identification of high-yield weak spots (e.g., Organic Chemistry, Bioenergetics)
    - Medical (65%) vs Dental (55%) eligibility assessment
    - AI-tailored remediation advice
    """
    total_q = len(payload.questions)
    correct_count = 0
    incorrect_count = 0
    unanswered_count = 0

    topic_stats: Dict[str, Dict[str, Any]] = {}

    for q in payload.questions:
        t_name = q.topic or q.subject or "General"
        if t_name not in topic_stats:
            topic_stats[t_name] = {
                "subject": q.subject,
                "total": 0,
                "correct": 0,
                "incorrect": 0,
            }
        topic_stats[t_name]["total"] += 1

        chosen = payload.user_answers.get(q.id)
        if not chosen:
            unanswered_count += 1
        elif chosen == q.correct_answer:
            correct_count += 1
            topic_stats[t_name]["correct"] += 1
        else:
            incorrect_count += 1
            topic_stats[t_name]["incorrect"] += 1

    accuracy_pct = round((correct_count / total_q) * 100, 1) if total_q > 0 else 0.0
    net_score = float(correct_count)

    breakdown: List[TopicMastery] = []
    weak_spots: List[str] = []

    for t_name, stat in topic_stats.items():
        t_total = stat["total"]
        t_corr = stat["correct"]
        t_acc = round((t_corr / t_total) * 100, 1) if t_total > 0 else 0.0

        if t_acc >= 80:
            status = "Mastered"
        elif t_acc >= 65:
            status = "Proficient"
        elif t_acc >= 50:
            status = "Needs Revision"
            weak_spots.append(f"{stat['subject']}: {t_name}")
        else:
            status = "Critical Weakness"
            weak_spots.append(f"{stat['subject']}: {t_name}")

        breakdown.append(
            TopicMastery(
                topic=t_name,
                subject=stat["subject"],
                total_questions=t_total,
                correct_count=t_corr,
                accuracy_percentage=t_acc,
                status=status
            )
        )

    # Remediation advice
    if accuracy_pct >= 65:
        remediation_summary = (
            f"Strong performance! Your score ({accuracy_pct}%) meets the MBBS qualifying threshold (65%+). "
            f"Focus on refining {', '.join(weak_spots[:2]) if weak_spots else 'speed and precision'} to maximize your merit standing."
        )
    else:
        remediation_summary = (
            f"Your score ({accuracy_pct}%) is below the 65% MBBS cut-off. Immediate revision is required on "
            f"{', '.join(weak_spots[:3]) if weak_spots else 'core high-yield chapters'}. Use spaced recall and practice chapter-wise tests."
        )

    return WeakAreaReportResponse(
        exam_id="mdcat_pakistan",
        overall_score=net_score,
        max_score=float(total_q),
        accuracy_percentage=accuracy_pct,
        net_score_with_negative_marking=net_score,
        readiness_index_percentage=accuracy_pct,
        total_correct=correct_count,
        total_incorrect=incorrect_count,
        total_unanswered=unanswered_count,
        topic_breakdown=breakdown,
        critical_weak_spots=weak_spots,
        ai_remediation_summary=remediation_summary,
        recommended_focus_topics=weak_spots[:4] if weak_spots else ["Biology: Cell Biology", "Chemistry: Organic Reactions"]
    )
