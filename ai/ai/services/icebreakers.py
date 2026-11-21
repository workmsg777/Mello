def suggest_icebreakers(shared_interests: list[str]) -> list[str]:
    """Grounded drafts only. No model receives instructions from a profile bio."""
    interests = list(dict.fromkeys(" ".join(label.split()) for label in shared_interests))[:3]
    if not interests:
        return ["What does a great weekend look like for you?", "What is something you have enjoyed recently?"]
    return [f"I noticed we both enjoy {interest}. What got you into it?" for interest in interests]
