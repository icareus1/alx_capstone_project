from flask import Flask, url_for, redirect, render_template, request, flash, jsonify
from flask_bcrypt import Bcrypt
from flask_login import login_user, current_user, logout_user, login_required
from forms import RegistrationForm, LoginForm, RequestResetForm, ResetPasswordForm
from models import db, login_manager, User, Task, Subtask
from flask_mail import Mail, Message
from apscheduler.triggers.date import DateTrigger
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
from dotenv import load_dotenv
import os
import secrets

load_dotenv()

app = Flask(__name__, template_folder='templates', static_folder='static')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = secrets.token_hex(32)
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('EMAIL_USER')
app.config['MAIL_PASSWORD'] = os.environ.get('EMAIL_PASS')
mail = Mail(app)

db.init_app(app)
bcrypt = Bcrypt(app)
login_manager.init_app(app)
login_manager.login_view = 'login'

scheduler = BackgroundScheduler()

@app.route('/')
@app.route('/landing')
def landing():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    return render_template('landing.html')

@app.route('/home')
@login_required
def home():
    user_id = current_user.id
    print(user_id)
    tasks = Task.query.filter_by(user_id=user_id).all()
    return render_template('home.html', tasks=tasks)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    form = RegistrationForm()
    if form.validate_on_submit():
        hashed_pwd = bcrypt.generate_password_hash(form.password.data).decode('utf8')
        user = User(username=form.username.data, email=form.email.data, password=hashed_pwd)
        db.session.add(user)
        db.session.commit()
        flash(f'Account created for {form.username.data} successfully!', 'success')
        return redirect(url_for('login'))
    return render_template('register.html', title='Register', form=form)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user and bcrypt.check_password_hash(user.password, form.password.data):
            login_user(user, remember=form.remember.data)
            next_page = request.args.get('next')
            return redirect(next_page) if next_page else redirect(url_for('home'))
        else:
            flash('Login Unsuccessful. Please check your email and password', 'danger')
    return render_template('login.html', title='Login', form=form)

@app.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('landing'))

@app.route('/task/new', methods=['POST'])
@login_required
def new_task():
    data = request.get_json()
    new_task = Task(name=data['name'], due_date=data['due_date'], user_id=current_user.id)
    db.session.add(new_task)
    db.session.commit()
    return jsonify({'message': 'Subtask created successfully'})
    return redirect(url_for('home'))

@app.route('/subtask/new', methods=['POST'])
@login_required
def new_subtask():
    data = request.get_json()
    new_subtask = Subtask(name=data['name'], task_id=data['task_id'])
    db.session.add(new_subtask)
    db.session.commit()
    return jsonify({'message': 'Subtask created successfully'})

@app.route('/toggle/<int:subtask_id>', methods=['GET'])
@login_required
def toggle_subtask(subtask_id):
    subtask = Subtask.query.get(subtask_id)
    if subtask:
        # Toggle the status of the subtask
        subtask.status = not subtask.status
        db.session.commit()
        return jsonify({'message': 'Subtask status toggled successfully'})
    else:
        return jsonify({'error': 'Subtask not found'}), 404

@app.route('/update_task_name/<int:task_id>', methods=['POST'])
@login_required
def update_task_name(task_id):
    new_name = request.json['new_name']
    task = Task.query.get(task_id)

    if task and task.user_id == current_user.id:
        task.name = new_name
        db.session.commit()
        return jsonify({'message': 'Task name updated successfully'})
    else:
        return jsonify({'error': 'Task not found or unauthorized'})

@app.route('/update_subtask_name/<int:subtask_id>', methods=['POST'])
@login_required
def update_subtask_name(subtask_id):
    new_name = request.json['new_name']
    subtask = Subtask.query.get(subtask_id)

    if subtask:
        task = Task.query.get(subtask.task_id)
        if task.user_id == current_user.id:
            subtask.name = new_name
            db.session.commit()
            return jsonify({'message': 'Subtask name updated successfully'})
    
    return jsonify({'error': 'Subtask not found or unauthorized'})

# Delete a Task
@app.route('/delete_task/<int:task_id>', methods=['POST'])
@login_required
def delete_task(task_id):
    task = Task.query.get(task_id)

    if task and task.user_id == current_user.id:
        # If the user is authorized to delete the task
        # Delete the task and its associated subtasks from the database
        for subtask in task.subtasks:
            db.session.delete(subtask)
        db.session.delete(task)
        db.session.commit()
        return jsonify({'message': 'Task and associated subtasks deleted successfully'})
    else:
        return jsonify({'error': 'Task not found or unauthorized'})


# Delete a Subtask
@app.route('/delete_subtask/<int:subtask_id>', methods=['POST'])
@login_required
def delete_subtask(subtask_id):
    subtask = Subtask.query.get(subtask_id)

    if subtask:
        # Check if the subtask is associated with the current user
        if subtask.task.user_id == current_user.id:
            # Delete the subtask from the database
            db.session.delete(subtask)
            db.session.commit()
            return jsonify({'message': 'Subtask deleted successfully'})
        else:
            return jsonify({'error': 'Unauthorized to delete this subtask'})
    else:
        return jsonify({'error': 'Subtask not found'})


def send_reset_email(user):
    token = user.get_reset_token()
    msg = Message('Password Reset Request',
                  sender='noreply@google.com',
                  recipients=[user.email])
    msg.body = f'''To reset your password, visit the following link:
{url_for('reset_token', token=token, _external=True)}

If you did not make this request then simply ignore this email and no changes will be made.
'''
    mail.send(msg)


@app.route("/reset_password", methods=['GET', 'POST'])
def reset_request():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    form = RequestResetForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        send_reset_email(user)
        flash('An email has been sent with instructions to reset your password.', 'info')
        return redirect(url_for('login'))
    return render_template('reset_request.html', title='Reset Password', form=form)


@app.route("/reset_password/<token>", methods=['GET', 'POST'])
def reset_token(token):
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    user = User.verify_reset_token(token)
    if user is None:
        flash('That is an invalid or expired token', 'warning')
        return redirect(url_for('reset_request'))
    form = ResetPasswordForm()
    if form.validate_on_submit():
        hashed_password = bcrypt.generate_password_hash(form.password.data).decode('utf-8')
        user.password = hashed_password
        db.session.commit()
        flash('Your password has been updated! You are now able to log in', 'success')
        return redirect(url_for('login'))
    return render_template('reset_token.html', title='Reset Password', form=form)

# Email Notification
def schedule_emails(task, scheduler):
    reminders = [
        ('1 day', -24),
        ('1 hour', -1),
        ('Time is up', 0)
    ]
    
    current_time = datetime.utcnow()
    
    for reminder_name, offset_time in reminders:
        trigger_time = task.due_date + timedelta(hours=offset_time)
        
        # Check if the trigger time is in the past
        # if trigger_time < current_time:
            # Send the email immediately
            # send_email(task, reminder_name)
            
            # Skip sending the email if the trigger time is in the past
            # continue
        
        # Schedule the email reminder
        scheduler.add_job(send_email,
                            trigger=DateTrigger(run_date=trigger_time),
                            args=[task, reminder_name])

def send_email(task, message):
    sender_email = 'noreply@google.com'
    receiver_email = task.user.email
    subject = 'Task Reminder'
    body = f'Task "{task.name}" is due in {message}.\n'
    
    if message == 'Time is up':
        body += 'This task is now disabled and can only be deleted.'
    
    send_email_notification(sender_email, receiver_email, subject, body)

def send_email_notification(sender, receiver, subject, body):
    msg = Message(subject, sender=sender, recipients=[receiver])
    msg.body = body
    mail.send(msg)



if __name__ == '__main__':
    with app.app_context():
        db.create_all()

        # Get all tasks from the database and schedule email reminders for each task
        tasks = Task.query.all()
        for task in tasks:
            schedule_emails(task, scheduler)
        try:
            scheduler.start()
        finally:
            if scheduler.running:
                # Clear existing jobs from the scheduler
                scheduler.remove_all_jobs()
                scheduler.shutdown()

    app.run(host='localhost', port=5000, debug=True)