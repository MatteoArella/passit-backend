# Insertions Service

Insertions service provides a REST API for managing tutor insertions.

## Insertions API
The following OpenAPI specification describes the resources provided by the API:

```yaml
openapi: "3.0.1"
info:
  title: "InsertionsRestApi"
servers:
- url: "https://<InsertionsRestApiId>.execute-api.<AWSRegion>.amazonaws.com/{basePath}"
  variables:
    basePath:
      default: "/v1"
paths:
  /insertions/{insertionId}:
    get:
      operationId: "GetInsertionById"
      responses:
        "400":
          description: "400 response"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "200":
          description: "200 response"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Insertion"
      security:
      - sigv4: []
  /insertions:
    get:
      operationId: "GetInsertions"
      parameters:
      - name: "tutorId"
        in: "query"
        schema:
          type: "string"
      - name: "after"
        in: "query"
        schema:
          type: "string"
      - name: "limit"
        in: "query"
        schema:
          type: "string"
      responses:
        "500":
          description: "500 response"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "200":
          description: "200 response"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/InsertionConnection"
      security:
      - sigv4: []
    post:
      operationId: "CreateInsertion"
      requestBody:
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/Insertion"
        required: true
      responses:
        "400":
          description: "400 response"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "500":
          description: "500 response"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "201":
          description: "201 response"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Insertion"
      security:
      - sigv4: []
components:
  schemas:
    Insertion:
      required:
      - "description"
      - "subject"
      - "title"
      - "tutorId"
      type: "object"
      properties:
        tutorId:
          type: "string"
          description: "the ID of the tutor who created the insertion"
        createdAt:
          type: "string"
          description: "the creation date of the insertion"
        subject:
          type: "string"
          description: "the subject of the insertion"
        description:
          type: "string"
          description: "the description of the insertion"
        id:
          type: "string"
          description: "the ID of the insertion"
        title:
          type: "string"
          description: "the title of the insertion"
        updatedAt:
          type: "string"
          description: "the last modification date of the insertion"
    Error:
      title: "Error Schema"
      type: "object"
      properties:
        message:
          type: "string"
    InsertionConnection:
      required:
      - "items"
      type: "object"
      properties:
        after:
          type: "string"
          description: "the next token for pagination"
        items:
          type: "array"
          items:
            $ref: "#/components/schemas/Insertion"
  securitySchemes:
    sigv4:
      type: "apiKey"
      name: "Authorization"
      in: "header"
      x-amazon-apigateway-authtype: "awsSigv4"
```

IAM Authorization is used for invoking the APIs.
