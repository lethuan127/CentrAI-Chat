-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "active_leaf_message_id" TEXT,
ADD COLUMN     "forked_from_conversation_id" TEXT,
ADD COLUMN     "forked_from_message_id" TEXT;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "parent_id" TEXT;

-- CreateIndex
CREATE INDEX "messages_parent_id_idx" ON "messages"("parent_id");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_active_leaf_message_id_fkey" FOREIGN KEY ("active_leaf_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
