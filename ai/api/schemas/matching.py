from typing import Annotated
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]
Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Candidate(StrictModel):
    key: UUID
    text: Text


class SemanticRequest(StrictModel):
    viewerText: Text
    candidates: list[Candidate] = Field(min_length=1, max_length=64)

    @model_validator(mode="after")
    def unique_candidates(self):
        if len({item.key for item in self.candidates}) != len(self.candidates):
            raise ValueError("candidate keys must be unique")
        return self


class SemanticScore(StrictModel):
    key: UUID
    similarity: float = Field(ge=0, le=1, allow_inf_nan=False)


class SemanticResponse(StrictModel):
    modelVersion: str
    scores: list[SemanticScore]


class IcebreakerRequest(StrictModel):
    sharedInterests: list[Label] = Field(default_factory=list, max_length=3)


class IcebreakerResponse(StrictModel):
    suggestions: list[str]
