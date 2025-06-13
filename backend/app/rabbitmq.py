import json
import aio_pika
from app.config import get_settings

settings = get_settings()

QUEUE_INGESTION = "ingestion_tasks"
QUEUE_NLP = "nlp_tasks"
QUEUE_VISION = "vision_tasks"
QUEUE_INSIGHTS = "insight_generation"


async def get_rabbitmq_connection():
    return await aio_pika.connect_robust(
        settings.RABBITMQ_URL,
        heartbeat=600,  # 10 min heartbeat to survive long NLP inference
    )


async def publish_task(queue_name: str, payload: dict) -> None:
    connection = await get_rabbitmq_connection()
    async with connection:
        channel = await connection.channel()
        queue = await channel.declare_queue(queue_name, durable=True)
        await channel.default_exchange.publish(
            aio_pika.Message(
                body=json.dumps(payload, default=str).encode(),
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            ),
            routing_key=queue.name,
        )
