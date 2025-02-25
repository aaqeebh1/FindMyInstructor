import request from "supertest";
import app from "../index.js";
import { sql } from "../db/index.js";

describe("Auth Routes", () => {
  beforeEach(async () => {
    // Clear test user if exists
    await sql`DELETE FROM users WHERE email = 'test@example.com'`;
  });

  test("Role selection flow", async () => {
    // First create a session
    const agent = request.agent(app);

    // Hit the test OAuth endpoint
    await agent
      .get("/auth/test-oauth")
      .expect(302)
      .expect("Location", "/auth/select-role");

    // Test role selection page
    const rolePageResponse = await agent.get("/auth/select-role").expect(200);

    // Should contain role selection buttons
    expect(rolePageResponse.text).toContain("I want to learn");
    expect(rolePageResponse.text).toContain("I want to teach");

    // Test role submission
    await agent
      .post("/auth/set-role")
      .send({ role: "learner" })
      .expect(302)
      .expect("Location", /\/oauth-success/);

    // Verify database update
    const user = await sql`
      SELECT * FROM users WHERE email = 'test@example.com'
    `;
    expect(user[0].role).toBe("learner");
  });
});
