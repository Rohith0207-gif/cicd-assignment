import os
import requests
import json
from fastapi import FastAPI, HTTPException, Depends, Request, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, validator
from datetime import date
import uuid
import firebase_admin
from firebase_admin import credentials, auth
from google.cloud import bigquery
from google.oauth2 import service_account
import google.auth
from google.auth.transport.requests import Request as GoogleRequest

# Initialize Firebase and BigQuery using local credentials file
firebase_cred_path = os.path.join(os.path.dirname(__file__), "firebase-service-account.json")
bigquery_cred_path = os.path.join(os.path.dirname(__file__), "leave-management-app-457708-40d556b35a47.json")
if os.path.exists(firebase_cred_path):
    cred = credentials.Certificate(firebase_cred_path)
    firebase_admin.initialize_app(cred)
else:
    raise HTTPException(status_code=500, detail="Firebase service account credentials file not found.")

# Firebase Web API Key
FIREBASE_API_KEY = "AIzaSyDOMe7R8AkOEXFcDGnhCQ1yJ5dM4CSKv1U"

# BigQuery setup using service account for authentication
bq_credentials = service_account.Credentials.from_service_account_file(bigquery_cred_path)
bq_client = bigquery.Client(credentials=bq_credentials, project=bq_credentials.project_id)
dataset_id = "leave_management"
table_id = f"{dataset_id}.leave_requests"

# Initialize BigQuery dataset and table
def initialize_bigquery():
    try:
        # Check if dataset exists
        try:
            bq_client.get_dataset(f"{bq_credentials.project_id}.{dataset_id}")
            print(f"Dataset {dataset_id} already exists")
        except Exception:
            print("Dataset does not exist. Creating dataset...")
            dataset = bigquery.Dataset(f"{bq_credentials.project_id}.{dataset_id}")
            dataset.location = "asia-south1"  # Set your preferred location
            dataset = bq_client.create_dataset(dataset, exists_ok=True)
            print(f"Created dataset {dataset_id}")

        # Check if table exists
        try:
            bq_client.get_table(f"{bq_credentials.project_id}.{dataset_id}.{table_id.split('.')[-1]}")
            print(f"Table {table_id} already exists")
        except Exception:
            print("Table does not exist. Creating table...")
            schema = [
                bigquery.SchemaField("employee_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("start_date", "DATE", mode="REQUIRED"),
                bigquery.SchemaField("end_date", "DATE", mode="REQUIRED"),
                bigquery.SchemaField("reason", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("leave_type", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("status", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("leave_id", "STRING", mode="REQUIRED")
            ]
            table = bigquery.Table(f"{bq_credentials.project_id}.{dataset_id}.{table_id.split('.')[-1]}", schema=schema)
            table = bq_client.create_table(table, exists_ok=True)
            print(f"Created table {table_id}")

        return True
    except Exception as e:
        print(f"Error initializing BigQuery: {str(e)}")
        return False

# Initialize BigQuery
if not initialize_bigquery():
    print("BigQuery initialization failed. Please check your permissions and try again.")
    print("The application will continue to run, but database operations will fail until setup is complete.")

# Initialize FastAPI app
app = FastAPI()

# Add security scheme
security = HTTPBearer()

# Enable CORS to allow frontend to make requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Add a test endpoint to verify CORS
@app.get("/test-cors")
async def test_cors():
    return {"message": "CORS is working!"}

# Customize Swagger UI
@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title="Leave Management API",
        swagger_js_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js",
        swagger_css_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css",
        swagger_favicon_url="https://fastapi.tiangolo.com/img/favicon.png",
        swagger_ui_parameters={"defaultModelsExpandDepth": -1},
    )

# Pydantic model for the leave request with validation
class LeaveRequest(BaseModel):
    start_date: date
    end_date: date
    reason: str
    leave_type: str

    @validator('end_date')
    def validate_end_date(cls, v, values):
        if 'start_date' in values and v < values['start_date']:
            raise ValueError('end_date must be after start_date')
        return v

    @validator('reason')
    def validate_reason(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('reason cannot be empty')
        return v.strip()

    @validator('leave_type')
    def validate_leave_type(cls, v):
        valid_types = ['Annual', 'Sick', 'Personal', 'Maternity', 'Paternity']
        if v not in valid_types:
            raise ValueError(f'leave_type must be one of: {", ".join(valid_types)}')
        return v

# Pydantic models for SignUp and SignIn
class UserSignUp(BaseModel):
    email: str
    password: str
    role: str  # Role can be 'employee' or 'manager'

class UserSignIn(BaseModel):
    email: str
    password: str

# Update the verify_token function to handle Firebase ID tokens
async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        # Get the ID token from the Authorization header
        id_token = credentials.credentials

        # Verify the ID token using Firebase Admin SDK
        decoded_token = auth.verify_id_token(id_token)

        # Get the user's UID from the decoded token
        uid = decoded_token['uid']

        # Get user details from Firebase Admin SDK
        user = auth.get_user(uid)

        # Get custom claims (role)
        user_claims = user.custom_claims or {}
        role = user_claims.get('role', 'employee')

        # Return user info with role
        return {
            'uid': uid,
            'email': user.email,
            'role': role
        }
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except auth.RevokedIdTokenError:
        raise HTTPException(status_code=401, detail="Token has been revoked")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication error: {str(e)}")

# ---------------- API Routes ---------------- #

# Route: Root check to ensure the server is running
@app.get("/")
def root():
    return {"message": "Leave Management System Backend is running."}

# Route: Sign Up (Register a new user with a role)
@app.post("/signup")
async def sign_up(user: UserSignUp):
    try:
        # Validate role
        if user.role.lower() not in ["employee", "manager"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid role. Must be 'employee' or 'manager'."
            )

        # Create user in Firebase
        firebase_user = auth.create_user(
            email=user.email,
            password=user.password
        )

        # Set the role in Firebase Custom Claims
        auth.set_custom_user_claims(firebase_user.uid, {"role": user.role.lower()})
        sign_in_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
        sign_in_data = {
            "email": user.email,
            "password": user.password,
            "returnSecureToken": True
        }

        response = requests.post(sign_in_url, json=sign_in_data)
        response_data = response.json()
        return {
            "message": f"User {firebase_user.uid} created successfully with role {user.role.lower()}.",
            "user": {
                "uid": firebase_user.uid,
                "email": user.email,
                "role": user.role.lower()
            },
            "token": response_data["idToken"]
        }
    except auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=400, detail="Email already in use")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Route: Sign In (Authenticate user and get token, return role)
@app.post("/signin")
async def sign_in(user: UserSignIn):
    try:
        # Verify email and password using Firebase REST API
        sign_in_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
        sign_in_data = {
            "email": user.email,
            "password": user.password,
            "returnSecureToken": True
        }

        response = requests.post(sign_in_url, json=sign_in_data)
        response_data = response.json()

        if response.status_code != 200:
            error_message = response_data.get("error", {}).get("message", "Invalid email or password")
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        # Get user details from Admin SDK
        user_id = response_data["localId"]
        user_record = auth.get_user(user_id)

        # Get user claims (role)
        user_claims = user_record.custom_claims or {}
        user_role = user_claims.get("role", "employee")  # Default to 'employee' if role is not set

        # Return the ID token from the sign-in response
        return {
            "message": "Sign-in successful",
            "user": {
                "uid": user_id,
                "email": user_record.email,
                "role": user_role
            },
            "id_token": response_data["idToken"]  # Return the ID token instead of custom token
        }
    except auth.UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Authentication failed: {str(e)}"
        )

# Route: Submit a leave request
@app.post("/leave")
async def submit_leave(leave: LeaveRequest, user=Depends(verify_token)):
    try:
        leave_id = str(uuid.uuid4())

        # Get the table schema to verify fields and their requirements
        table = bq_client.get_table(f"{bq_credentials.project_id}.{dataset_id}.{table_id.split('.')[-1]}")

        # Print the table schema for debugging
        print("Table Schema:")
        for field in table.schema:
            print(f"Field: {field.name}, Type: {field.field_type}, Mode: {field.mode}")

        # Create a dictionary to store field values with all required fields
        row_data = {
            'employee_id': user['uid'],
            'start_date': str(leave.start_date),
            'end_date': str(leave.end_date),
            'reason': leave.reason,
            'leave_type': leave.leave_type,
            'status': 'Pending',  # Default status for new leave requests
            'leave_id': leave_id
        }

        print("Row data to insert:", row_data)

        try:
            # Create SQL query for insertion
            query = f"""
                INSERT INTO `{bq_credentials.project_id}.{dataset_id}.{table_id.split('.')[-1]}`
                (employee_id, start_date, end_date, reason, leave_type, status, leave_id)
                VALUES (
                    '{row_data['employee_id']}',
                    '{row_data['start_date']}',
                    '{row_data['end_date']}',
                    '{row_data['reason'].replace("'", "''")}',  -- Escape single quotes
                    '{row_data['leave_type']}',
                    '{row_data['status']}',
                    '{row_data['leave_id']}'
                )
            """

            print("Executing query:", query)

            # Execute the query
            query_job = bq_client.query(query)
            query_job.result()  # Wait for the query to complete

            return {
                "message": "Leave request submitted successfully",
                "leave_id": leave_id,
                "data": {
                    "start_date": str(leave.start_date),
                    "end_date": str(leave.end_date),
                    "reason": leave.reason,
                    "leave_type": leave.leave_type,
                    "status": "Pending"
                }
            }

        except Exception as e:
            if "Access Denied" in str(e):
                raise HTTPException(
                    status_code=403,
                    detail="Database access denied. Please ensure your service account has BigQuery permissions."
                )
            elif "Not found" in str(e):
                raise HTTPException(
                    status_code=404,
                    detail="Database or table not found. Please ensure the dataset and table are created."
                )
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Database error: {str(e)}"
                )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error submitting leave request: {str(e)}"
        )

# Route: Get all leave requests for the current user
@app.get("/leave")
async def list_leaves(user=Depends(verify_token)):
    try:
        # Get the table schema to verify fields
        table = bq_client.get_table(f"{bq_credentials.project_id}.{dataset_id}.{table_id.split('.')[-1]}")
        existing_fields = {field.name: field.field_type for field in table.schema}

        # Build query with only existing fields
        fields = [field for field in ['leave_id', 'start_date', 'end_date', 'reason', 'leave_type', 'status']
                  if field in existing_fields]

        if not fields:
            raise HTTPException(
                status_code=500,
                detail="No valid fields found in the table"
            )

        query = f"""
            SELECT {', '.join(fields)}
            FROM `{bq_credentials.project_id}.{dataset_id}.{table_id.split('.')[-1]}`
            WHERE employee_id = '{user['uid']}'
        """

        try:
            results = list(bq_client.query(query))
            return [dict(row) for row in results]
        except Exception as e:
            if "Access Denied" in str(e):
                raise HTTPException(
                    status_code=403,
                    detail="Database access denied. Please ensure your service account has BigQuery permissions."
                )
            elif "Not found" in str(e):
                raise HTTPException(
                    status_code=404,
                    detail="Database or table not found. Please ensure the dataset and table are created."
                )
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Database error: {str(e)}"
                )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching leave requests: {str(e)}"
        )

# Route: Approve a leave request (for managers only)
@app.post("/leave/{leave_id}/approve")
async def approve_leave(leave_id: str = Path(...), user=Depends(verify_token)):
    # Check if user is a manager
    if user.get("role") != "manager":
        raise HTTPException(status_code=403, detail="Only managers can approve leave requests.")

    try:
        # First check if the leave request exists and is in Pending status
        check_query = f"""
            SELECT status FROM `{bq_credentials.project_id}.{dataset_id}.{table_id.split('.')[-1]}`
            WHERE leave_id = '{leave_id}'
        """
        check_job = bq_client.query(check_query)
        result = list(check_job)

        if not result:
            raise HTTPException(status_code=404, detail="Leave request not found")

        current_status = result[0].status
        if current_status != 'Pending':
            raise HTTPException(
                status_code=400,
                detail=f"Cannot approve leave request. Current status is {current_status}. Only Pending requests can be approved."
            )

        # Create SQL query to update the leave status
        query = f"""
            UPDATE `{bq_credentials.project_id}.{dataset_id}.{table_id.split('.')[-1]}`
            SET status = 'Approved'
            WHERE leave_id = '{leave_id}'
        """

        # Execute the query
        query_job = bq_client.query(query)
        query_job.result()  # Wait for the query to complete

        return {
            "message": f"Leave request {leave_id} approved successfully",
            "leave_id": leave_id,
            "status": "Approved"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error approving leave request: {str(e)}"
        )

# Route: Reject a leave request (for managers only)
@app.post("/leave/{leave_id}/reject")
async def reject_leave(leave_id: str = Path(...), user=Depends(verify_token)):
    # Check if user is a manager
    if user.get("role") != "manager":
        raise HTTPException(status_code=403, detail="Only managers can reject leave requests.")

    try:
        # First check if the leave request exists and is in Pending status
        check_query = f"""
            SELECT status FROM `{bq_credentials.project_id}.{dataset_id}.{table_id.split('.')[-1]}`
            WHERE leave_id = '{leave_id}'
        """
        check_job = bq_client.query(check_query)
        result = list(check_job)

        if not result:
            raise HTTPException(status_code=404, detail="Leave request not found")

        current_status = result[0].status
        if current_status != 'Pending':
            raise HTTPException(
                status_code=400,
                detail=f"Cannot reject leave request. Current status is {current_status}. Only Pending requests can be rejected."
            )

        # Create SQL query to update the leave status
        query = f"""
            UPDATE `{bq_credentials.project_id}.{dataset_id}.{table_id.split('.')[-1]}`
            SET status = 'Rejected'
            WHERE leave_id = '{leave_id}'
        """

        # Execute the query
        query_job = bq_client.query(query)
        query_job.result()  # Wait for the query to complete

        return {
            "message": f"Leave request {leave_id} rejected successfully",
            "leave_id": leave_id,
            "status": "Rejected"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error rejecting leave request: {str(e)}"
        )

# Route: Delete a leave request
@app.delete("/leave/{leave_id}")
async def delete_leave(leave_id: str = Path(...), user=Depends(verify_token)):
    query = f"""
        DELETE FROM `{table_id}`
        WHERE leave_id = '{leave_id}'
    """
    try:
        query_job = bq_client.query(query)
        query_job.result()
        return {"message": f"Leave request {leave_id[:9]} deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Route: Get all leave requests (for managers only)
@app.get("/leaves/all")
async def get_all_leaves(user=Depends(verify_token)):
    print("Received request to get all leaves")
    print(f"User role: {user.get('role')}")

    # Check if user is a manager
    if user.get("role") != "manager":
        print("Access denied: User is not a manager")
        raise HTTPException(status_code=403, detail="Only managers can view all leave requests.")

    try:
        print("Creating SQL query")
        # Create SQL query to get all leave requests
        query = f"""
            SELECT
                leave_id,
                employee_id,
                start_date,
                end_date,
                reason,
                leave_type,
                status
            FROM `{bq_credentials.project_id}.{dataset_id}.{table_id.split('.')[-1]}`
            ORDER BY start_date DESC
        """

        print("Executing query")
        # Execute the query
        query_job = bq_client.query(query)
        results = list(query_job)
        print(f"Query executed successfully. Found {len(results)} results")

        # Convert results to list of dictionaries
        leaves = []
        for row in results:
            leaves.append({
                "leave_id": row.leave_id,
                "employee_id": row.employee_id,
                "start_date": str(row.start_date),
                "end_date": str(row.end_date),
                "reason": row.reason,
                "leave_type": row.leave_type,
                "status": row.status
            })

        print("Returning response")
        return leaves
    except Exception as e:
        print(f"Error occurred: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving leave requests: {str(e)}"
        )

# ---------------- Helper Functions ---------------- #

async def update_leave_status(leave_id: str, new_status: str):
    query = f"""
        UPDATE `{table_id}`
        SET status = '{new_status}'
        WHERE leave_id = '{leave_id}'
    """
    try:
        query_job = bq_client.query(query)
        query_job.result()
        return {"message": f"Leave request {leave_id[:9]} {new_status.lower()}."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
