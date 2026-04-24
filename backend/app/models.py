import uuid
from datetime import datetime, timezone
from pydantic import EmailStr
from sqlalchemy import DateTime
from sqlmodel import Field, Relationship, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(timezone.utc)


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore[assignment]
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    items: list["Item"] = Relationship(back_populates="owner", cascade_delete=True)


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID
    created_at: datetime | None = None


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Shared properties
class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Properties to receive on item creation
class ItemCreate(ItemBase):
    pass


# Properties to receive on item update
class ItemUpdate(ItemBase):
    title: str | None = Field(default=None, min_length=1, max_length=255)  # type: ignore[assignment]


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="items")


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


# ---------- DocVault ----------

class DocumentTag(SQLModel, table=True):
    document_id: uuid.UUID = Field(
        foreign_key="document.id", primary_key=True, ondelete="CASCADE"
    )
    tag_id: uuid.UUID = Field(
        foreign_key="tag.id", primary_key=True, ondelete="CASCADE"
    )


class Tag(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(min_length=1, max_length=50, index=True)
    owner_id: uuid.UUID = Field(foreign_key="user.id", nullable=False, ondelete="CASCADE")
    documents: list["Document"] = Relationship(
        back_populates="tags", link_model=DocumentTag
    )


class TagPublic(SQLModel):
    id: uuid.UUID
    name: str


class DocumentBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    creator: str = Field(min_length=1, max_length=255)
    format: str = Field(min_length=1, max_length=50)
    subject: str | None = Field(default=None, max_length=500)


class DocumentCreate(DocumentBase):
    pass


class Document(DocumentBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(foreign_key="user.id", nullable=False, ondelete="CASCADE")
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    versions: list["DocumentVersion"] = Relationship(
        back_populates="document", cascade_delete=True
    )
    tags: list[Tag] = Relationship(back_populates="documents", link_model=DocumentTag)


class DocumentVersionBase(SQLModel):
    version_number: int
    sha256: str = Field(max_length=64)
    original_filename: str = Field(max_length=255)
    file_size: int


class DocumentVersion(DocumentVersionBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    document_id: uuid.UUID = Field(
        foreign_key="document.id", nullable=False, ondelete="CASCADE"
    )
    file_path: str = Field(max_length=500)
    content_text: str | None = Field(default=None)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    document: Document = Relationship(back_populates="versions")


class DocumentVersionPublic(DocumentVersionBase):
    id: uuid.UUID
    document_id: uuid.UUID
    created_at: datetime | None = None


class DocumentPublic(DocumentBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None
    tags: list[TagPublic] = []


class DocumentWithVersions(DocumentPublic):
    versions: list[DocumentVersionPublic] = []


class DocumentsPublic(SQLModel):
    data: list[DocumentPublic]
    count: int


class StorageStats(SQLModel):
    document_count: int
    version_count: int
    total_size_bytes: int


class BulkDeleteRequest(SQLModel):
    ids: list[uuid.UUID]


# ---------- Google Drive Integration ----------

class DriveConnection(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", nullable=False, ondelete="CASCADE", unique=True)
    access_token: str = Field(max_length=4096)   # Fernet-encrypted
    refresh_token: str = Field(max_length=4096)  # Fernet-encrypted
    token_expiry: datetime = Field(sa_type=DateTime(timezone=True))  # type: ignore
    connected_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class DriveConnectionPublic(SQLModel):
    connected: bool
    connected_at: datetime | None = None


class DriveImportJob(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", nullable=False, ondelete="CASCADE")
    folder_id: str = Field(max_length=255)
    folder_name: str = Field(max_length=500)
    status: str = Field(default="pending", max_length=20)  # pending|running|completed|failed
    total_files: int = Field(default=0)
    imported_files: int = Field(default=0)
    skipped_files: int = Field(default=0)
    failed_files: int = Field(default=0)
    error_message: str | None = Field(default=None, max_length=2000)
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    completed_at: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class DriveImportJobPublic(SQLModel):
    id: uuid.UUID
    folder_id: str
    folder_name: str
    status: str
    total_files: int
    imported_files: int
    skipped_files: int
    failed_files: int
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None


class DriveImportRequest(SQLModel):
    folder_id: str
    folder_name: str


class DriveFolderItem(SQLModel):
    id: str
    name: str