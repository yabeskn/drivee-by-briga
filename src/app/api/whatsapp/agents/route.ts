import { type NextRequest, NextResponse } from "next/server";
import { agentManager } from "@/lib/baileys/manager";

const VALID_STATUSES = ["active", "inactive", "banned"] as const;
type AgentStatusValue = (typeof VALID_STATUSES)[number];

function isValidStatus(value: unknown): value is AgentStatusValue {
	return (
		typeof value === "string" &&
		(VALID_STATUSES as readonly string[]).includes(value)
	);
}

export async function GET(): Promise<NextResponse> {
	try {
		const agents = agentManager.getStatus();
		return NextResponse.json({ success: true, data: agents });
	} catch (_error) {
		return NextResponse.json(
			{ success: false, error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
	try {
		const { agentId, status, phone } = await request.json();

		if (!agentId || !status) {
			return NextResponse.json(
				{ success: false, error: "agentId and status are required" },
				{ status: 400 },
			);
		}

		if (!isValidStatus(status)) {
			return NextResponse.json(
				{
					success: false,
					error: `Invalid status '${status}'. Expected one of: ${VALID_STATUSES.join(", ")}`,
				},
				{ status: 400 },
			);
		}

		const agent = agentManager.getAgent(agentId);
		if (!agent) {
			return NextResponse.json(
				{ success: false, error: "Agent not found" },
				{ status: 404 },
			);
		}

		if (typeof phone === "string" && phone.trim() !== "") {
			agent.config.phone = phone.trim();
		}

		// Terapkan status sungguhan: manager benar-benar connect/disconnect soket
		// dan mengembalikan error bila transport WhatsApp tidak tersedia.
		const result = await agentManager.setAgentStatus(agentId, status);

		if (!result.success) {
			return NextResponse.json(
				{
					success: false,
					error: result.error,
					data: {
						agentId,
						status: result.status,
						runtimeStatus: agent.currentStatus,
					},
				},
				{ status: 503 },
			);
		}

		return NextResponse.json({
			success: true,
			message: `Agent ${agentId} status updated to ${result.status}`,
			data: {
				agentId,
				status: result.status,
				runtimeStatus: agent.currentStatus,
			},
		});
	} catch (error) {
		console.error("[API] WhatsApp agent status update error:", error);
		return NextResponse.json(
			{ success: false, error: "Internal server error" },
			{ status: 500 },
		);
	}
}
