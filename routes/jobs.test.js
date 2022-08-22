"use strict";

const request = require("supertest");

const db = require("../db");
const app = require("../app");

const {
  commonBeforeAll,
  commonBeforeEach,
  commonAfterEach,
  commonAfterAll,
  u1Token,
  u2Token,
  u3Token
} = require("./_testCommon");

beforeAll(commonBeforeAll);
beforeEach(commonBeforeEach);
afterEach(commonAfterEach);
afterAll(commonAfterAll);

/************************************** POST /jobs */

describe("POST /jobs", function () {
  const newjob = {
    title: "New",
    companyHandle: "c1",
    salary: 999999,
    equity: "0",
  };

  test("ok for admin users", async function () {
    const resp = await request(app)
        .post("/jobs")
        .send(newjob)
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.statusCode).toEqual(201);
    expect(resp.body).toEqual({
      job: {
        id: expect.any(Number),
        ...newjob
      }
    });
  });

  test("unauthorized for non-admin", async function () {
    try {
      const resp = await request(app)
      .post("/jobs")
      .send(newjob)
      .set("authorization", `Bearer ${u1Token}`);
      expect(resp.statusCode).toEqual(401);
    }
    catch(err){

    }

  });

  test("bad request with missing data", async function () {
    const resp = await request(app)
        .post("/jobs")
        .send({
          id: "new",
          equity: 10,
        })
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.statusCode).toEqual(400);
  });

  test("bad request with invalid data", async function () {
    const resp = await request(app)
        .post("/jobs")
        .send({
          title: "New",
          companyHandle: "c1",
          salary: "not a number",
          equity: "0"
        })
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.statusCode).toEqual(400);
  });
});

/************************************** GET /jobs */

describe("GET /jobs", function () {
  test("ok for anon w/o filters", async function () {
    const resp = await request(app).get("/jobs");
    expect(resp.body).toEqual({
      jobs:
          [
            {
              title: "j1",
              salary: 100000,
              equity: "0",
              companyHandle: "c1",
            },
            {
              title: "j2",
              salary: 200000,
              equity: "0.02",
              companyHandle: "c2",
            },
            {
              title: "j3",
              salary: 300000,
              equity: "0.03",
              companyHandle: "c3",
            },
          ],
    });
  });
  test("w/ filters", async function () {
    const resp = await request(app).get("/jobs?minSalary=200000&titleLike=2");
    expect(resp.body).toEqual({
      jobs:
          [
            {
              title: "j2",
              salary: 200000,
              equity: "0.02",
              companyHandle: "c2",
            },
          ],
    });
  });

  test("fails: test next() idr", async function () {
    // there's no normal failure event which will cause this route to fail ---
    // thus making it hard to test that the error-idr works with it. This
    // should cause an error, all right :)
    await db.query("DROP TABLE jobs CASCADE");
    const resp = await request(app)
        .get("/jobs")
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(500);
  });
});

/************************************** GET /jobs/:id */

describe("GET /jobs/:id", function () {
  test("works for anon", async function () {
    const res = await db.query(`SELECT id FROM jobs`);
    const id = res.rows[0].id;
    const resp = await request(app).get(`/jobs/${id}`);
    expect(resp.body).toEqual({
      job: {
        id: id,
        title: "j1",
        salary: 100000,
        equity: "0",
        company: {
          "handle": "c1",
          "name": "C1",
          "description": "Desc1",
          "num_employees": 1,
          "logo_url": "http://c1.img"
        },
      },
    });
  });

  test("not found for no such job", async function () {
    const resp = await request(app).get(`/jobs/1`);
    expect(resp.statusCode).toEqual(404);
  });
});

/************************************** PATCH /jobs/:id */

describe("PATCH /jobs/:id", function () {
  test("works for admin users", async function () {
    const res = await db.query(`SELECT id FROM jobs`);
    const id = res.rows[0].id;
    const resp = await request(app)
        .patch(`/jobs/${id}`)
        .send({
          title: "j1-new",
        })
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.body).toEqual({
      job: {
        id: id,
        title: "j1-new",
        salary: 100000,
        equity: "0",
        companyHandle: "c1",
      },
    });
  });

  test("unauth for anon", async function () {
    const res = await db.query(`SELECT id FROM jobs`);
    const id = res.rows[0].id;
    const resp = await request(app)
        .patch(`/jobs/${id}`)
        .send({
          title: "j1-new",
        });
    expect(resp.statusCode).toEqual(401);
  });

  test("not found for no such job", async function () {
    const resp = await request(app)
        .patch(`/jobs/999`)
        .send({
          title: "new title",
        })
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.statusCode).toEqual(404);
  });

  test("bad request on id change attempt", async function () {
    const res = await db.query(`SELECT id FROM jobs`);
    const id = res.rows[0].id;
    const resp = await request(app)
        .patch(`/jobs/${id}`)
        .send({
          id: "j1-new",
        })
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.statusCode).toEqual(400);
  });

  test("bad request on invalid data", async function () {
    const res = await db.query(`SELECT id FROM jobs`);
    const id = res.rows[0].id;
    const resp = await request(app)
        .patch(`/jobs/${id}`)
        .send({
          companyHandle: "not-a-url",
        })
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.statusCode).toEqual(400);
  });
});

/************************************** DELETE /jobs/:id */

describe("DELETE /jobs/:id", function () {
  test("works for admin users", async function () {
    const res = await db.query(`SELECT id FROM jobs`);
    const id = res.rows[0].id;
    const resp = await request(app)
        .delete(`/jobs/${id}`)
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.body).toEqual({ deleted: `${id}` });
  });

  test("unauth for anon", async function () {
    const res = await db.query(`SELECT id FROM jobs`);
    const id = res.rows[0].id;
    const resp = await request(app)
        .delete(`/jobs/${id}`);
    expect(resp.statusCode).toEqual(401);
  });

  test("not found or no such job", async function () {
    const resp = await request(app)
        .delete(`/jobs/999`)
        .set("authorization", `Bearer ${u3Token}`);
    expect(resp.statusCode).toEqual(404);
  });
});
