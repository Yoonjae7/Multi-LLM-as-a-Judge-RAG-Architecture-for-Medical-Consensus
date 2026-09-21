(function () {
  const toggle = document.querySelector('.view-toggle');
  const buttons = document.querySelectorAll('.toggle-btn');
  const homeView = document.getElementById('home-view');
  const demoView = document.getElementById('demo-view');
  const nav = document.querySelector('.nav');

  if (!toggle || !homeView || !demoView) return;

  const translations = {
    en: {
      lang: 'en',
      title: 'Multi-LLM-as-a-Judge RAG Architecture for Western Medicine',
      view: ['Home', 'Demo'],
      nav: ['About', 'Architecture', 'Research', 'Paper'],
      aria: ['Page view', 'Primary navigation', 'Language'],
      hero: [
        'University of Nottingham · Research Internship',
        'Multi-LLM-as-a-Judge RAG Architecture for Western Medicine',
        'A multi-agent healthcare AI framework combining Retrieval-Augmented Generation, Agentic AI, and LLM-as-a-Judge to deliver evidence-grounded, explainable Western medicine information with complementary nutrition and lifestyle perspectives.'
      ],
      roles: ['Supervisor', 'Research Intern', 'BSc (Hons) Computer Science with AI'],
      about: {
        title: 'Research Problem',
        lead: 'Current healthcare AI assistants suffer from critical limitations.',
        problems: [
          '<strong>Hallucinations.</strong> Models generate plausible but unsupported medical claims without grounding in authoritative sources.',
          '<strong>Lack of evidence transparency.</strong> Responses rarely cite clinical guidelines, literature, or explain the strength of underlying evidence.',
          '<strong>Fragmented perspectives.</strong> Systems struggle to reconcile clinical, nutrition, and lifestyle recommendations grounded in different evidence sources.',
          '<strong>Poor safety governance.</strong> Unsafe advice, contraindications, and unsupported claims often pass through without automated review.',
          '<strong>Limited explainability.</strong> Users receive single opaque answers rather than transparent reasoning, uncertainty, or disagreement.'
        ],
        visionLabel: 'Research Vision',
        vision: 'To develop a trustworthy and explainable Western medicine AI ecosystem that intelligently integrates clinical, nutrition, and lifestyle evidence, verifies recommendations through evidence-aware AI judges, and provides transparent, safety-conscious health guidance, transforming healthcare AI from a single-answer chatbot into a virtual multidisciplinary advisory board.'
      },
      architecture: {
        title: 'System Architecture', lead: 'From health question to retrieved evidence, specialist debate, safety judging, and final consensus.',
        input: ['Input', 'Question Intake', 'User context is interpreted and routed into the correct medical knowledge paths.', 'User', 'Asks a health question', 'Query Planner', 'Analyzes the question and plans retrieval and agents'],
        retrieval: ['Retrieval', 'Authoritative Evidence Grounding', 'Western medical guidance and biomedical literature are retrieved before specialist agents produce their answers.', 'Modern medicine retrieval'],
        governance: ['Governance', 'Debate, Judge, Consensus', 'Specialist agents propose answers, then SafeJudge checks evidence, risk, conflict, and confidence.', 'Multi-Agent Debate', 'Domain-specific agents independently generate recommendations and rationales'],
        agents: [['Western Medicine Agent', 'Evidence-based modern medicine'], ['Nutrition Agent', 'Dietary guidance'], ['Lifestyle Agent', 'Behavioral and wellness guidance']],
        judge: ['SafeJudge', 'LLM-as-a-Judge evaluates, verifies, and scores all agent outputs'],
        judges: [['Evidence Judge', 'Checks citation quality'], ['Safety Judge', 'Detects risks and contraindications'], ['Conflict Judge', 'Identifies conflicts between agents'], ['Confidence Judge', 'Estimates uncertainty levels']],
        output: ['Integrated Response', 'Synthesized, evidence-aware, and safety-validated recommendation'],
        outputItems: ['Summary of recommendations', 'Evidence & citations', 'Agreements & disagreements', 'Safety notes', 'Confidence score']
      },
      research: {
        title: 'Research Questions', lead: 'Key questions guiding the investigation.',
        questions: [
          'Can multi-agent retrieval and reasoning improve the factual accuracy and completeness of healthcare question answering compared with conventional RAG systems?',
          'Can LLM-as-a-Judge mechanisms effectively detect hallucinations, unsafe recommendations, and unsupported claims in healthcare AI outputs?',
          'How can AI systems reconcile clinical, nutrition, and lifestyle recommendations while maintaining transparency and user trust?',
          'Does multi-agent debate and consensus-building improve healthcare answer quality compared with single-agent generation?',
          'How should healthcare AI communicate evidence strength, uncertainty, and conflicting viewpoints to end users?',
          'Can multi-perspective Western medicine AI increase user confidence and perceived trustworthiness without sacrificing scientific rigor?'
        ]
      },
      demo: {
        eyebrow: 'MediRAG-West Demo', title: 'Watch the consensus pipeline work', lead: 'Ask a Western medicine question and follow the evidence, specialist agents, judges, and final response.',
        kicker: 'MediRAG-West · Research Prototype', panelTitle: 'Evidence-Based Western Medicine', panelLead: 'Ask a health question and watch it move through the system: the Query Planner, evidence retrieval, three specialist agents, and the four SafeJudge checks, before a single answer is produced.',
        live: 'Live AI · Demo fallback ready', question: 'Health question *', placeholder: 'e.g. I have been getting frequent headaches and feeling unusually tired for the past 3 weeks.', helper: 'Describe your symptoms and when they started. Do not include identifying personal information.', samplesLabel: 'Try a sample',
        samples: [['Persistent headache + fatigue', 'I have been getting frequent headaches and feeling unusually tired for the past 3 weeks.'], ['Chest tightness on exertion', 'I experience tightness in my chest when climbing stairs or walking fast. It goes away with rest.'], ['Elevated blood pressure (145/92)', 'My blood pressure reading was 145/92. I am 48 years old. Should I be concerned?'], ['Safety triage path', 'I have crushing chest pain and I cannot breathe properly.']],
        paths: 'Real specialist agents and judges answer live from a local evidence library covering headaches, chest pain, blood pressure, back pain, colds, allergies, digestion, sleep and anxiety. Emergency signs stop the pipeline immediately, while an unsupported topic produces an evidence-based abstention. Read the <a href="research.html">research paper</a> for the design rationale.',
        formSafety: '<strong>Research use only.</strong> Not a diagnosis or prescription. Emergencies require immediate professional care.', submit: 'Run MediRAG-West',
        runtimeTitle: 'Watch it work', runtimeLead: 'This is the same flow as the architecture diagram on the Home page.', running: 'Running',
        noticeTitle: 'Demo fallback active', noticeBody: 'Live AI is unavailable, so the same pipeline is continuing with deterministic outputs grounded in the retrieved local evidence.',
        rail: ['Question', 'Query Planner', 'MediRAG-West', 'Agent Debate', 'SafeJudge', 'Response'],
        initialStage: 'Getting ready', initialExplain: 'Ask a question above to start.', agents: 'Agents', activity: 'Activity',
        urgentTitle: 'Urgent Safety Guidance', urgentBody: 'This response prioritises immediate professional medical care. Please seek help now.',
        integrated: 'Integrated Response', sourcesPending: 'Sources pending', fallbackBadge: 'Demo fallback', confidence: 'Confidence', safetyNotes: 'Safety notes', detailTitle: 'How this answer was reached',
        detailSteps: ['Each agent answered from the same evidence', 'Where they disagreed', 'Four judges scored the answers'], evidence: 'Show the sources that were used',
        disclaimer: 'Educational research prototype only. Not a diagnosis or prescription, and not a substitute for qualified medical care.'
      },
      footer: ['© 2026 University of Nottingham Research Internship', 'Multi-LLM-as-a-Judge RAG Architecture for Western Medicine - website by Yoonjae Lee', 'Research Paper', 'Architecture & model selection'],
      dynamic: {
        status: { running: 'Running', done: 'Finished', demo: 'Demo complete', urgent: 'Stopped for safety', abstain: 'No answer given', veto: 'Blocked by SafeJudge', error: 'Failed' },
        confidence: { low: 'Low confidence', medium: 'Moderate confidence', high: 'High confidence', label: 'Confidence' },
        sources: 'Based on {count} sources',
        prefixes: { western: 'From a Western medicine perspective, ', nutrition: 'From a nutrition perspective, ', lifestyle: 'From a lifestyle perspective, ' },
        unsupportedRole: 'The retrieved sources do not support a more specific {role} recommendation for this question.',
        fallbackGap: 'Demo fallback cannot add facts beyond the local evidence shown below.',
        fallbackEnd: 'This is a deterministic demonstration of the consensus workflow, not a live AI-generated clinical answer.',
        fallbackSafety: ['This is general educational information, not a diagnosis or treatment plan.', 'Because demo fallback is active, have a qualified clinician assess any real or persistent health concern.', 'Seek urgent professional care if symptoms are severe, sudden, or rapidly worsening.'],
        judgeNotes: ['Demo check: each displayed claim is linked to retrieved local evidence.', 'Demo check: no diagnosis, dose, or medication-change instruction was generated.', 'Demo check: the specialist outputs differ in emphasis but do not materially conflict.', 'Demo check: certainty is capped because these are deterministic fallback outputs.'],
        dispatch: { waiting: 'Waiting', thinking: 'Thinking', demo: 'Demo result', sure: '{score}% sure' },
        agentNotes: { revised: 'Revised after debate: {note}', gap: 'Could not tell: {note}' },
        evidenceCertainty: '{grade} certainty',
        special: {
          safetySummary: 'Your question mentions signs of a possible {reason}. The system stopped straight away, so it did not search for evidence and did not run any agents. That is deliberate, because discussing symptoms here could delay care. Please get urgent medical help now. In the UK call 999, or 111 if you are unsure. Elsewhere, call your local emergency number or go to an emergency department.',
          safetyLabel: 'Safety stop', noEvidence: 'No evidence searched',
          safetyNotes: ['If this is an emergency, call emergency services now. Do not wait for any AI system.', 'If you are having thoughts of harming yourself, contact your local crisis line or emergency services immediately. In the UK, Samaritans are free on 116 123, at any hour.', 'This prototype does not assess or triage patients and must never be relied on in an emergency.'],
          vetoSummary: 'The Safety Judge blocked this answer before it reached you. Its note: “{note}” This is the SafeJudge veto described in the research report: a safety concern is never averaged away by the other three judges; it stops the answer outright.',
          answerWithheld: 'Answer withheld', vetoNotes: ['For a real health concern, speak to a qualified clinician rather than any AI system.', 'If this is urgent, contact emergency services rather than waiting for a system response.'],
          abstainSummary: 'No answer was given, because the search did not find any local source close enough to your question. The system is built to stop here rather than let a model answer from memory, since that is where confident but unsupported claims come from. Try rephrasing, or ask about headaches and fatigue, chest tightness, blood pressure, back pain, colds, allergies, digestion, or sleep and anxiety—the topics currently in the local library.',
          noAnswer: 'No answer', noSources: 'No matching sources', abstainNotes: ['Declining is safer than a fluent answer built on nothing.', 'For a real health concern, speak to a qualified clinician rather than any AI system.']
        },
        stage: {
          question: ['Question', 'Your question enters the system.'], planner: ['Query Planner', 'Checking for emergency warning signs.'], retrieval: ['MediRAG-West', 'Searching the local evidence library.'], debate: ['Agent Debate', 'Three agents are answering independently from the same evidence.'], judge: ['SafeJudge', 'Four judges are scoring the answers.'], response: ['Integrated Response', 'Combining everything into one answer.']
        },
        validation: 'Please enter a health question of at least 3 characters.', loading: 'Running', submit: 'Run MediRAG-West', error: 'The AI backend could not be reached. The demo fallback should continue automatically; please try again if this message persists.'
      }
    },
    ko: {
      lang: 'ko',
      title: '서양의학을 위한 Multi-LLM-as-a-Judge RAG 아키텍처',
      view: ['홈', '데모'],
      nav: ['소개', '아키텍처', '연구', '논문'],
      aria: ['페이지 보기', '주요 탐색', '언어 선택'],
      hero: ['노팅엄 대학교 · 연구 인턴십', '서양의학을 위한 Multi-LLM-as-a-Judge RAG 아키텍처', '검색 증강 생성, 에이전트 AI, LLM-as-a-Judge를 결합하여 영양 및 생활습관 관점과 함께 근거 기반의 설명 가능한 서양의학 정보를 제공하는 다중 에이전트 헬스케어 AI 프레임워크입니다.'],
      roles: ['지도교수', '연구 인턴', '컴퓨터공학 및 AI 학사과정'],
      about: {
        title: '연구 문제', lead: '현재 헬스케어 AI 어시스턴트에는 중요한 한계가 있습니다.',
        problems: ['<strong>환각.</strong> 모델이 권위 있는 근거 없이 그럴듯하지만 뒷받침되지 않는 의학적 주장을 생성합니다.', '<strong>근거 투명성 부족.</strong> 답변이 임상 지침과 문헌을 충분히 인용하거나 근거의 강도를 설명하지 못합니다.', '<strong>분절된 관점.</strong> 서로 다른 근거에 기반한 임상, 영양, 생활습관 권고를 조화롭게 다루기 어렵습니다.', '<strong>안전 관리 부족.</strong> 위험한 조언, 금기, 근거 없는 주장이 자동 검증 없이 통과할 수 있습니다.', '<strong>설명 가능성 부족.</strong> 사용자는 투명한 추론, 불확실성, 의견 차이 대신 불투명한 단일 답변만 받기 쉽습니다.'],
        visionLabel: '연구 비전', vision: '임상, 영양, 생활습관 근거를 지능적으로 통합하고 근거 인식형 AI judge로 권고를 검증하며 투명하고 안전 중심의 건강 정보를 제공하는 신뢰 가능한 서양의학 AI 생태계를 개발합니다. 단일 답변 챗봇을 가상의 다학제 자문위원회로 확장하는 것이 목표입니다.'
      },
      architecture: {
        title: '시스템 아키텍처', lead: '건강 질문에서 근거 검색, 전문가 토론, 안전성 판단, 최종 합의까지 이어지는 흐름입니다.',
        input: ['입력', '질문 접수', '사용자 맥락을 해석하고 적절한 의학 지식 경로로 전달합니다.', '사용자', '건강 질문을 입력합니다', '쿼리 플래너', '질문을 분석하고 검색 및 에이전트 구성을 계획합니다'],
        retrieval: ['검색', '권위 있는 근거 기반', '전문 에이전트가 답변하기 전에 서양의학 지침과 생의학 문헌을 검색합니다.', '현대 의학 근거 검색'],
        governance: ['거버넌스', '토론, 판단, 합의', '전문 에이전트가 답변을 제안하고 SafeJudge가 근거, 위험, 충돌, 신뢰도를 점검합니다.', '다중 에이전트 토론', '분야별 에이전트가 독립적으로 권고와 근거를 생성합니다'],
        agents: [['서양의학 에이전트', '근거 기반 현대 의학'], ['영양 에이전트', '식이 및 영양 안내'], ['생활습관 에이전트', '행동 및 건강생활 안내']],
        judge: ['SafeJudge', 'LLM-as-a-Judge가 모든 에이전트 출력을 평가, 검증, 점수화합니다'],
        judges: [['근거 Judge', '인용 품질 점검'], ['안전 Judge', '위험과 금기 탐지'], ['충돌 Judge', '에이전트 간 충돌 식별'], ['신뢰도 Judge', '불확실성 추정']],
        output: ['통합 응답', '근거를 반영하고 안전성을 검증한 종합 안내'], outputItems: ['권고 요약', '근거 및 인용', '합의와 불일치', '안전 참고사항', '신뢰도 점수']
      },
      research: {
        title: '연구 질문', lead: '연구를 이끄는 핵심 질문입니다.', questions: ['다중 에이전트 검색과 추론은 기존 RAG 시스템보다 헬스케어 질의응답의 사실 정확성과 완성도를 높일 수 있는가?', 'LLM-as-a-Judge 메커니즘은 헬스케어 AI 출력의 환각, 위험 권고, 근거 없는 주장을 효과적으로 탐지할 수 있는가?', 'AI 시스템은 투명성과 사용자 신뢰를 유지하면서 임상, 영양, 생활습관 권고를 어떻게 조화시킬 수 있는가?', '다중 에이전트 토론과 합의 형성은 단일 에이전트 생성보다 답변 품질을 개선하는가?', '헬스케어 AI는 근거의 강도, 불확실성, 상충되는 관점을 사용자에게 어떻게 전달해야 하는가?', '다중 관점 서양의학 AI는 과학적 엄밀성을 유지하면서 사용자 신뢰를 높일 수 있는가?']
      },
      demo: {
        eyebrow: 'MediRAG-West 데모', title: '합의 파이프라인의 작동 과정을 확인하세요', lead: '서양의학 질문을 입력하고 근거, 전문 에이전트, judge, 최종 응답의 흐름을 확인하세요.',
        kicker: 'MediRAG-West · 연구 프로토타입', panelTitle: '근거 기반 서양의학', panelLead: '건강 질문을 입력하면 쿼리 플래너, 근거 검색, 세 전문 에이전트, 네 가지 SafeJudge 검사를 거쳐 하나의 답변이 만들어지는 과정을 볼 수 있습니다.',
        live: '실시간 AI · 데모 대체 모드 준비', question: '건강 질문 *', placeholder: '예: 지난 3주 동안 두통이 자주 생기고 평소보다 많이 피곤합니다.', helper: '증상과 시작 시점을 적어 주세요. 개인 식별 정보는 입력하지 마세요.', samplesLabel: '예시 질문',
        samples: [['지속적인 두통과 피로', '지난 3주 동안 두통이 자주 생기고 평소보다 많이 피곤합니다.'], ['운동할 때 가슴 조임', '계단을 오르거나 빨리 걸을 때 가슴이 조이고 쉬면 괜찮아집니다.'], ['높은 혈압 (145/92)', '혈압이 145/92로 나왔습니다. 48세인데 걱정해야 할까요?'], ['안전 분류 경로', '가슴이 심하게 아프고 숨을 제대로 쉴 수 없습니다.']],
        paths: '실시간 전문 에이전트와 judge가 두통, 흉통, 혈압, 허리 통증, 감기, 알레르기, 소화, 수면, 불안에 관한 로컬 근거 자료를 사용합니다. 응급 신호가 있으면 즉시 중단하며, 근거가 없는 주제에는 답변을 보류합니다. 설계 근거는 <a href="research.html">연구 논문</a>에서 확인할 수 있습니다.',
        formSafety: '<strong>연구용입니다.</strong> 진단이나 처방이 아닙니다. 응급 상황에는 즉시 전문 의료 도움을 받으세요.', submit: 'MediRAG-West 실행',
        runtimeTitle: '작동 과정 보기', runtimeLead: '홈 화면의 아키텍처와 동일한 흐름입니다.', running: '실행 중', noticeTitle: '데모 대체 모드 활성화', noticeBody: '실시간 AI를 사용할 수 없어 검색된 로컬 근거에 기반한 결정론적 출력으로 동일한 파이프라인을 계속 실행합니다.',
        rail: ['질문', '쿼리 플래너', 'MediRAG-West', '에이전트 토론', 'SafeJudge', '응답'], initialStage: '준비 중', initialExplain: '위에서 질문을 입력하면 시작됩니다.', agents: '에이전트', activity: '활동 로그',
        urgentTitle: '긴급 안전 안내', urgentBody: '이 응답은 즉각적인 전문 의료 도움을 우선합니다. 지금 도움을 요청하세요.', integrated: '통합 응답', sourcesPending: '근거 준비 중', fallbackBadge: '데모 대체 모드', confidence: '신뢰도', safetyNotes: '안전 참고사항', detailTitle: '답변 도출 과정',
        detailSteps: ['각 에이전트가 동일한 근거로 답변했습니다', '에이전트의 의견 차이', '네 개의 judge가 답변을 평가했습니다'], evidence: '사용된 근거 보기', disclaimer: '교육·연구용 프로토타입이며 진단이나 처방이 아닙니다. 전문 의료인의 진료를 대신하지 않습니다.'
      },
      footer: ['© 2026 노팅엄 대학교 연구 인턴십', '서양의학을 위한 Multi-LLM-as-a-Judge RAG 아키텍처 - Yoonjae Lee 제작', '연구 논문', '아키텍처 및 모델 선정'],
      dynamic: {
        status: { running: '실행 중', done: '완료', demo: '데모 완료', urgent: '안전을 위해 중단됨', abstain: '답변 보류', veto: 'SafeJudge가 차단함', error: '실패' },
        confidence: { low: '낮은 신뢰도', medium: '보통 신뢰도', high: '높은 신뢰도', label: '신뢰도' }, sources: '{count}개 근거 기반',
        prefixes: { western: '서양의학 관점에서, ', nutrition: '영양 관점에서, ', lifestyle: '생활습관 관점에서, ' }, unsupportedRole: '검색된 근거로는 이 질문에 대한 구체적인 {role} 권고를 뒷받침할 수 없습니다.', fallbackGap: '데모 대체 모드는 아래에 표시된 로컬 근거 외의 사실을 추가하지 않습니다.', fallbackEnd: '이는 합의 워크플로우를 보여 주는 결정론적 데모이며 실시간 AI가 생성한 임상 답변이 아닙니다.',
        fallbackSafety: ['일반적인 교육 정보이며 진단이나 치료 계획이 아닙니다.', '데모 대체 모드가 활성화되었으므로 실제 또는 지속되는 건강 문제는 의료 전문가에게 평가받으세요.', '증상이 심하거나 갑작스럽거나 빠르게 악화되면 즉시 전문 의료 도움을 받으세요.'],
        judgeNotes: ['데모 검사: 표시된 각 주장은 검색된 로컬 근거와 연결됩니다.', '데모 검사: 진단, 용량 또는 약물 변경 지시는 생성되지 않았습니다.', '데모 검사: 전문가 출력은 강조점만 다르며 실질적으로 충돌하지 않습니다.', '데모 검사: 결정론적 대체 출력이므로 확실성에 상한을 적용했습니다.'],
        dispatch: { waiting: '대기 중', thinking: '검토 중', demo: '데모 결과', sure: '{score}% 확신' },
        agentNotes: { revised: '토론 후 수정: {note}', gap: '확인할 수 없음: {note}' },
        evidenceCertainty: '{grade} 확실성',
        special: {
          safetySummary: '질문에서 {reason} 가능성을 시사하는 징후가 감지되었습니다. 근거 검색과 에이전트 실행을 즉시 중단했습니다. 증상에 관한 논의가 치료를 지연시킬 수 있기 때문입니다. 지금 즉시 응급 의료 도움을 받으세요. 영국에서는 999에 전화하고, 확실하지 않으면 111에 문의하세요. 다른 지역에서는 현지 응급 번호로 전화하거나 응급실로 가세요.',
          safetyLabel: '안전 중단', noEvidence: '근거 검색 안 함',
          safetyNotes: ['응급 상황이면 지금 응급 서비스에 연락하세요. AI 시스템의 답변을 기다리지 마세요.', '자해나 자살 생각이 있다면 현지 위기 상담 또는 응급 서비스에 즉시 연락하세요.', '이 프로토타입은 환자를 평가하거나 분류하지 않으며 응급 상황에서 절대 의존해서는 안 됩니다.'],
          vetoSummary: 'Safety Judge가 답변이 사용자에게 전달되기 전에 차단했습니다. 판정 메모: “{note}” 이는 연구 보고서의 SafeJudge 거부권입니다. 안전 문제는 다른 세 judge의 점수로 상쇄되지 않으며 답변을 즉시 중단합니다.',
          answerWithheld: '답변 보류', vetoNotes: ['실제 건강 문제는 AI가 아닌 자격을 갖춘 의료 전문가와 상담하세요.', '긴급한 경우 시스템 답변을 기다리지 말고 응급 서비스에 연락하세요.'],
          abstainSummary: '질문과 충분히 가까운 로컬 근거를 찾지 못해 답변을 제공하지 않았습니다. 근거 없이 모델의 기억에 의존하면 확신에 찬 잘못된 주장이 생길 수 있으므로 시스템은 여기서 중단합니다. 질문을 바꾸어 입력하거나 현재 라이브러리가 지원하는 두통과 피로, 흉부 압박감, 혈압, 허리 통증, 감기, 알레르기, 소화, 수면 및 불안에 관해 질문해 보세요.',
          noAnswer: '답변 없음', noSources: '일치하는 근거 없음', abstainNotes: ['근거 없는 유창한 답변보다 답변을 보류하는 편이 안전합니다.', '실제 건강 문제는 AI가 아닌 자격을 갖춘 의료 전문가와 상담하세요.']
        },
        stage: { question: ['질문', '질문이 시스템에 입력되었습니다.'], planner: ['쿼리 플래너', '응급 위험 신호를 확인합니다.'], retrieval: ['MediRAG-West', '로컬 근거 라이브러리를 검색합니다.'], debate: ['에이전트 토론', '세 에이전트가 동일한 근거로 독립적으로 답변합니다.'], judge: ['SafeJudge', '네 개의 judge가 답변을 평가합니다.'], response: ['통합 응답', '모든 결과를 하나의 답변으로 결합합니다.'] },
        validation: '건강 질문을 3자 이상 입력해 주세요.', loading: '실행 중', submit: 'MediRAG-West 실행', error: 'AI 백엔드에 연결할 수 없습니다. 데모 대체 모드가 자동으로 계속되어야 합니다. 이 메시지가 계속되면 다시 시도해 주세요.'
      }
    }
  };

  let currentLanguage = 'en';

  function getPath(object, path) {
    return path.split('.').reduce(function (value, key) { return value && value[key]; }, object);
  }

  function interpolate(value, variables) {
    return String(value).replace(/\{(\w+)\}/g, function (_, key) {
      return variables && variables[key] !== undefined ? variables[key] : '';
    });
  }

  window.MediRAGI18n = {
    getLanguage: function () { return currentLanguage; },
    t: function (path, variables, fallback) {
      const value = getPath(translations[currentLanguage], path);
      return interpolate(value === undefined ? fallback || path : value, variables);
    }
  };

  function setText(selector, value) { const el = document.querySelector(selector); if (el) el.textContent = value; }
  function setHTML(selector, value) { const el = document.querySelector(selector); if (el) el.innerHTML = value; }
  function setTextList(selector, values) {
    document.querySelectorAll(selector).forEach(function (el, index) { if (values[index] !== undefined) el.textContent = values[index]; });
  }

  function applyLanguage(language) {
    const t = translations[language] || translations.en;
    currentLanguage = language;
    document.documentElement.lang = t.lang;
    document.title = t.title;
    try { localStorage.setItem('medirag:language', language); } catch (error) { /* optional */ }

    setTextList('.toggle-btn', t.view); setTextList('.nav a', t.nav);
    toggle.setAttribute('aria-label', t.aria[0]); if (nav) nav.setAttribute('aria-label', t.aria[1]);
    const languageSwitch = document.querySelector('.language-switch'); if (languageSwitch) languageSwitch.setAttribute('aria-label', t.aria[2]);
    setText('.hero .eyebrow', t.hero[0]); setText('.hero h1', t.hero[1]); setText('.hero .lead', t.hero[2]);
    setText('.team-list li:first-child .member-role', t.roles[0]);
    document.querySelectorAll('.team-list li:not(:first-child) .member-role').forEach(function (el) { el.textContent = t.roles[1]; });
    document.querySelectorAll('.member-major').forEach(function (el) { el.textContent = t.roles[2]; });

    setText('#about h2', t.about.title); setText('#about .section-header p', t.about.lead); setTextList('#about .plain-list li', []);
    document.querySelectorAll('#about .plain-list li').forEach(function (el, i) { if (t.about.problems[i]) el.innerHTML = t.about.problems[i]; });
    setText('.vision-label', t.about.visionLabel); setText('.vision p:last-child', t.about.vision);

    setText('#architecture .section-header h2', t.architecture.title); setText('#architecture .section-header p', t.architecture.lead);
    setText('.arch-stage-input .metric-kicker', t.architecture.input[0]); setText('.arch-stage-input h3', t.architecture.input[1]); setText('.arch-stage-input .arch-stage-header p', t.architecture.input[2]);
    setText('.arch-stage-input [data-layer="1"] strong', t.architecture.input[3]); setText('.arch-stage-input [data-layer="1"] .node-text span', t.architecture.input[4]);
    setText('.arch-stage-input [data-layer="2"] strong', t.architecture.input[5]); setText('.arch-stage-input [data-layer="2"] .node-text span', t.architecture.input[6]);
    setText('.arch-stage-retrieval .metric-kicker', t.architecture.retrieval[0]); setText('.arch-stage-retrieval h3', t.architecture.retrieval[1]); setText('.arch-stage-retrieval .arch-stage-header p', t.architecture.retrieval[2]); setText('.arch-stage-retrieval .node-text span', t.architecture.retrieval[3]);
    setText('.arch-stage-governance .metric-kicker', t.architecture.governance[0]); setText('.arch-stage-governance h3', t.architecture.governance[1]); setText('.arch-stage-governance .arch-stage-header p', t.architecture.governance[2]); setText('.layer-debate .container-label', t.architecture.governance[3]); setText('.layer-debate .container-desc', t.architecture.governance[4]);
    document.querySelectorAll('.layer-debate .arch-node').forEach(function (el, i) { if (t.architecture.agents[i]) { el.querySelector('strong').textContent = t.architecture.agents[i][0]; el.querySelector('span').textContent = t.architecture.agents[i][1]; } });
    setText('.layer-judge .container-label', t.architecture.judge[0]); setText('.layer-judge .container-desc', t.architecture.judge[1]);
    document.querySelectorAll('.layer-judge .arch-node').forEach(function (el, i) { if (t.architecture.judges[i]) { el.querySelector('strong').textContent = t.architecture.judges[i][0]; el.querySelector('span').textContent = t.architecture.judges[i][1]; } });
    setText('.arch-node-output .node-text strong', t.architecture.output[0]); setText('.arch-node-output .node-text span', t.architecture.output[1]); setTextList('.node-output-list li', t.architecture.outputItems);

    setText('#research h2', t.research.title); setText('#research .section-header p', t.research.lead); setTextList('.rq-list li', t.research.questions);
    setText('.demo-section .eyebrow', t.demo.eyebrow); setText('.demo-title', t.demo.title); setText('.demo-lead', t.demo.lead);
    setText('.west-kicker', t.demo.kicker); setText('#west-consultation-title', t.demo.panelTitle); setText('.west-panel-heading > div > p:last-child', t.demo.panelLead); setText('.west-live-label', t.demo.live);
    setText('.west-question-field > span', t.demo.question); const question = document.getElementById('west-question'); if (question) question.placeholder = t.demo.placeholder; setText('.west-question-field small', t.demo.helper); setText('.west-samples > span', t.demo.samplesLabel);
    document.querySelectorAll('.west-sample').forEach(function (el, i) { if (t.demo.samples[i]) { el.textContent = t.demo.samples[i][0]; el.dataset.question = t.demo.samples[i][1]; } });
    setHTML('.west-paths-note', t.demo.paths); setHTML('.west-form-footer p', t.demo.formSafety); setText('.west-submit-label', t.demo.submit);
    setText('.west-runtime-title h3', t.demo.runtimeTitle); setText('.west-runtime-title p', t.demo.runtimeLead); setText('#west-runtime-state-label', t.demo.running); setText('#west-demo-notice strong', t.demo.noticeTitle); setText('#west-demo-notice div > span', t.demo.noticeBody); setTextList('.west-rail-name', t.demo.rail); setText('#west-net-stage', t.demo.initialStage); setText('#west-net-explain', t.demo.initialExplain); setTextList('.west-sub-head', [t.demo.agents, t.demo.activity]);
    setText('#west-urgent-banner strong', t.demo.urgentTitle); setText('#west-urgent-banner div > span', t.demo.urgentBody); setText('.west-consensus-kicker', t.demo.integrated); setText('#west-evidence-count', t.demo.sourcesPending); setText('#west-response-mode', t.demo.fallbackBadge); setText('#west-conf-label', t.demo.confidence); setText('.west-safety-head h3', t.demo.safetyNotes); setText('.west-detail-title', t.demo.detailTitle); setTextList('.west-step-text', t.demo.detailSteps); setText('.west-accordion > summary', t.demo.evidence); setText('.west-disclaimer', t.demo.disclaimer);
    setText('.site-footer p:first-child', t.footer[0]); setText('.footer-sub', t.footer[1]); setText('.research-fab-text strong', t.footer[2]); setText('.research-fab-text small', t.footer[3]);

    document.querySelectorAll('.language-btn').forEach(function (button) { const active = button.dataset.lang === language; button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', active ? 'true' : 'false'); });
    window.dispatchEvent(new CustomEvent('medirag:languagechange', { detail: { language: language } }));
  }

  function setView(view) {
    const isDemo = view === 'demo';
    document.body.classList.toggle('demo-mode', isDemo); toggle.classList.toggle('is-demo', isDemo);
    buttons.forEach(function (button) { const active = button.dataset.view === view; button.classList.toggle('is-active', active); button.setAttribute('aria-selected', active ? 'true' : 'false'); });
    homeView.hidden = isDemo; demoView.hidden = !isDemo; if (nav) nav.hidden = isDemo;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  buttons.forEach(function (button) { button.addEventListener('click', function () { setView(button.dataset.view); }); });
  document.querySelectorAll('.language-btn').forEach(function (button) { button.addEventListener('click', function () { applyLanguage(button.dataset.lang); }); });

  let requestedDemo = window.location.hash === '#demo';
  try { if (sessionStorage.getItem('medirag:openDemo') === '1') { sessionStorage.removeItem('medirag:openDemo'); requestedDemo = true; } } catch (error) { /* optional */ }
  let initialLanguage = 'en';
  try { if (localStorage.getItem('medirag:language') === 'ko') initialLanguage = 'ko'; } catch (error) { /* optional */ }
  applyLanguage(initialLanguage);
  if (requestedDemo) setView('demo');
})();
