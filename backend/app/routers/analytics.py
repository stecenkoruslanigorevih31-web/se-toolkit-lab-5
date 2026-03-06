"""Router for analytics endpoints.

Each endpoint performs SQL aggregation queries on the interaction data
populated by the ETL pipeline. All endpoints require a `lab` query
parameter to filter results by lab (e.g., "lab-01").
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import get_session
from app.models.interaction import InteractionLog
from app.models.item import ItemRecord
from app.models.learner import Learner

router = APIRouter()


@router.get("/scores")
async def get_scores(
    lab: str = Query(..., description="Lab identifier, e.g. 'lab-01'"),
    session: AsyncSession = Depends(get_session),
):
    """Score distribution histogram for a given lab.

    TODO: Implement this endpoint.
    - Find the lab item by matching title (e.g. "lab-04" → title contains "Lab 04")
    - Find all tasks that belong to this lab (parent_id = lab.id)
    - Query interactions for these items that have a score
    - Group scores into buckets: "0-25", "26-50", "51-75", "76-100"
      using CASE WHEN expressions
    - Return a JSON array:
      [{"bucket": "0-25", "count": 12}, {"bucket": "26-50", "count": 8}, ...]
    - Always return all four buckets, even if count is 0
    """
    # Convert "lab-04" to "Lab 04" for title matching
    lab_number = lab.replace("lab-", "Lab ")
    
    # Find the lab item
    lab_item = await session.exec(
        select(ItemRecord).where(
            ItemRecord.type == "lab",
            ItemRecord.title.contains(lab_number)
        )
    )
    lab_record = lab_item.first()
    
    if not lab_record:
        return [{"bucket": "0-25", "count": 0}, {"bucket": "26-50", "count": 0},
                {"bucket": "51-75", "count": 0}, {"bucket": "76-100", "count": 0}]
    
    # Get all item IDs for this lab (lab itself + child tasks)
    task_items = await session.exec(
        select(ItemRecord.id).where(ItemRecord.parent_id == lab_record.id)
    )
    item_ids = [lab_record.id] + list(task_items.all())
    
    # Define the bucket CASE expression
    bucket_expr = case(
        (InteractionLog.score <= 25, "0-25"),
        (InteractionLog.score <= 50, "26-50"),
        (InteractionLog.score <= 75, "51-75"),
        else_="76-100",
    ).label("bucket")
    
    # Query with grouping by bucket
    query = (
        select(bucket_expr, func.count(InteractionLog.id).label("count"))
        .where(
            InteractionLog.item_id.in_(item_ids),
            InteractionLog.score.isnot(None)
        )
        .group_by(bucket_expr)
    )
    
    results = await session.exec(query)
    bucket_counts = {row.bucket: row.count for row in results.all()}
    
    # Ensure all 4 buckets are present
    all_buckets = ["0-25", "26-50", "51-75", "76-100"]
    return [{"bucket": b, "count": bucket_counts.get(b, 0)} for b in all_buckets]


@router.get("/pass-rates")
async def get_pass_rates(
    lab: str = Query(..., description="Lab identifier, e.g. 'lab-01'"),
    session: AsyncSession = Depends(get_session),
):
    """Per-task pass rates for a given lab.

    TODO: Implement this endpoint.
    - Find the lab item and its child task items
    - For each task, compute:
      - avg_score: average of interaction scores (round to 1 decimal)
      - attempts: total number of interactions
    - Return a JSON array:
      [{"task": "Repository Setup", "avg_score": 92.3, "attempts": 150}, ...]
    - Order by task title
    """
    # Convert "lab-04" to "Lab 04" for title matching
    lab_number = lab.replace("lab-", "Lab ")
    
    # Find the lab item
    lab_item = await session.exec(
        select(ItemRecord).where(
            ItemRecord.type == "lab",
            ItemRecord.title.contains(lab_number)
        )
    )
    lab_record = lab_item.first()
    
    if not lab_record:
        return []
    
    # Get task item IDs for this lab
    task_items = await session.exec(
        select(ItemRecord).where(ItemRecord.parent_id == lab_record.id)
    )
    tasks = list(task_items.all())
    
    if not tasks:
        return []
    
    task_ids = [t.id for t in tasks]
    
    # Query: join interactions with items, group by task, compute avg and count
    query = (
        select(
            ItemRecord.title.label("task"),
            func.round(func.avg(InteractionLog.score), 1).label("avg_score"),
            func.count(InteractionLog.id).label("attempts"),
        )
        .join(ItemRecord, InteractionLog.item_id == ItemRecord.id)
        .where(ItemRecord.id.in_(task_ids))
        .group_by(ItemRecord.title)
        .order_by(ItemRecord.title)
    )
    
    results = await session.exec(query)
    
    return [
        {"task": row.task, "avg_score": float(row.avg_score), "attempts": row.attempts}
        for row in results.all()
    ]


@router.get("/timeline")
async def get_timeline(
    lab: str = Query(..., description="Lab identifier, e.g. 'lab-01'"),
    session: AsyncSession = Depends(get_session),
):
    """Submissions per day for a given lab.

    TODO: Implement this endpoint.
    - Find the lab item and its child task items
    - Group interactions by date (use func.date(created_at))
    - Count the number of submissions per day
    - Return a JSON array:
      [{"date": "2026-02-28", "submissions": 45}, ...]
    - Order by date ascending
    """
    # Convert "lab-04" to "Lab 04" for title matching
    lab_number = lab.replace("lab-", "Lab ")
    
    # Find the lab item
    lab_item = await session.exec(
        select(ItemRecord).where(
            ItemRecord.type == "lab",
            ItemRecord.title.contains(lab_number)
        )
    )
    lab_record = lab_item.first()
    
    if not lab_record:
        return []
    
    # Get all item IDs for this lab (lab itself + child tasks)
    task_items = await session.exec(
        select(ItemRecord.id).where(ItemRecord.parent_id == lab_record.id)
    )
    item_ids = [lab_record.id] + list(task_items.all())
    
    # Query: group by date, count submissions
    query = (
        select(
            func.date(InteractionLog.created_at).label("date"),
            func.count(InteractionLog.id).label("submissions"),
        )
        .where(InteractionLog.item_id.in_(item_ids))
        .group_by(func.date(InteractionLog.created_at))
        .order_by(func.date(InteractionLog.created_at))
    )
    
    results = await session.exec(query)
    
    return [
        {"date": str(row.date), "submissions": row.submissions}
        for row in results.all()
    ]


@router.get("/groups")
async def get_groups(
    lab: str = Query(..., description="Lab identifier, e.g. 'lab-01'"),
    session: AsyncSession = Depends(get_session),
):
    """Per-group performance for a given lab.

    TODO: Implement this endpoint.
    - Find the lab item and its child task items
    - Join interactions with learners to get student_group
    - For each group, compute:
      - avg_score: average score (round to 1 decimal)
      - students: count of distinct learners
    - Return a JSON array:
      [{"group": "B23-CS-01", "avg_score": 78.5, "students": 25}, ...]
    - Order by group name
    """
    # Convert "lab-04" to "Lab 04" for title matching
    lab_number = lab.replace("lab-", "Lab ")
    
    # Find the lab item
    lab_item = await session.exec(
        select(ItemRecord).where(
            ItemRecord.type == "lab",
            ItemRecord.title.contains(lab_number)
        )
    )
    lab_record = lab_item.first()
    
    if not lab_record:
        return []
    
    # Get all item IDs for this lab (lab itself + child tasks)
    task_items = await session.exec(
        select(ItemRecord.id).where(ItemRecord.parent_id == lab_record.id)
    )
    item_ids = [lab_record.id] + list(task_items.all())
    
    # Query: join interactions with learners, group by group
    query = (
        select(
            Learner.student_group.label("group"),
            func.round(func.avg(InteractionLog.score), 1).label("avg_score"),
            func.count(func.distinct(InteractionLog.learner_id)).label("students"),
        )
        .join(Learner, InteractionLog.learner_id == Learner.id)
        .where(InteractionLog.item_id.in_(item_ids))
        .group_by(Learner.student_group)
        .order_by(Learner.student_group)
    )
    
    results = await session.exec(query)
    
    return [
        {"group": row.group, "avg_score": float(row.avg_score), "students": row.students}
        for row in results.all()
    ]
